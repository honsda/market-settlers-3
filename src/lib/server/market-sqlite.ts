import type { PricePoint } from '../market';
import { db, newId, type HistoryRow } from './db';
import { serverEnv } from './env';
import {
	DAY,
	EMPTY_STATS,
	HISTORY_DAYS,
	evaluateMarketUpdate,
	midOf,
	type AlertCandidate,
	type HistorySnapshot,
	type HistoryStats
} from './market-core';

export function getBestPrices(itemId: string): { bid: number | null; ask: number | null } {
	const row = db
		.prepare(
			`SELECT
				MAX(CASE WHEN side = 'buy' THEN price END) AS bid,
				MIN(CASE WHEN side = 'sell' THEN price END) AS ask
			 FROM offers WHERE item_id = ? AND status = 'open'`
		)
		.get(itemId) as { bid: number | null; ask: number | null };
	return { bid: row?.bid ?? null, ask: row?.ask ?? null };
}

export function getHistory(itemId: string, days = HISTORY_DAYS): PricePoint[] {
	const since = Date.now() - days * DAY;
	const rows = db
		.prepare(
			`SELECT bid, ask, ts FROM price_history
			 WHERE item_id = ? AND ts >= ? ORDER BY ts ASC LIMIT 400`
		)
		.all(itemId, since) as unknown as Pick<HistoryRow, 'bid' | 'ask' | 'ts'>[];
	return rows.map((row) => ({
		ts: row.ts,
		bid: row.bid,
		ask: row.ask,
		mid: midOf(row.bid, row.ask)
	}));
}

export function getAllHistory(days = HISTORY_DAYS): Map<string, PricePoint[]> {
	const since = Date.now() - days * DAY;
	const rows = db
		.prepare(
			`SELECT item_id, bid, ask, ts FROM price_history
			 WHERE ts >= ? ORDER BY ts ASC`
		)
		.all(since) as unknown as (Pick<HistoryRow, 'bid' | 'ask' | 'ts'> & { item_id: string })[];
	const map = new Map<string, PricePoint[]>();
	for (const row of rows) {
		const list = map.get(row.item_id) ?? [];
		list.push({ ts: row.ts, bid: row.bid, ask: row.ask, mid: midOf(row.bid, row.ask) });
		map.set(row.item_id, list);
	}
	return map;
}

function getStats(itemId: string, since: number): HistoryStats {
	const row = db
		.prepare(
			`SELECT
				MIN(CASE WHEN bid IS NOT NULL THEN bid END) AS bidMin,
				MAX(CASE WHEN bid IS NOT NULL THEN bid END) AS bidMax,
				MIN(CASE WHEN ask IS NOT NULL THEN ask END) AS askMin,
				MAX(CASE WHEN ask IS NOT NULL THEN ask END) AS askMax,
				COUNT(*) AS points
			 FROM price_history WHERE item_id = ? AND ts >= ?`
		)
		.get(itemId, since) as unknown as HistoryStats;
	return row;
}

function hasRecentAlert(itemId: string, kind: string, minutes: number): boolean {
	const row = db
		.prepare(
			`SELECT 1 AS hit FROM alerts
			 WHERE item_id = ? AND kind = ? AND created_at > ?
			 LIMIT 1`
		)
		.get(itemId, kind, Date.now() - minutes * 60_000) as { hit: number } | undefined;
	return Boolean(row);
}

function createAlert(input: AlertCandidate): void {
	if (hasRecentAlert(input.itemId, input.kind, serverEnv.alertCooldownMinutes)) return;
	db.prepare(
		`INSERT INTO alerts (id, item_id, kind, side, price, previous, change_pct, message, created_at, posted_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
	).run(
		newId(),
		input.itemId,
		input.kind,
		input.side,
		input.price,
		input.previous,
		input.changePct,
		input.message,
		Date.now()
	);
}

/**
 * Snapshot the best bid/ask after a market mutation and queue Discord alerts
 * when a price makes a significant move. Called inside the write transaction.
 */
export function refreshMarketState(itemId: string): void {
	const now = Date.now();
	const { bid, ask } = getBestPrices(itemId);
	if (bid === null && ask === null) return;

	const last = db
		.prepare(
			`SELECT bid, ask, ts FROM price_history WHERE item_id = ?
			 ORDER BY ts DESC LIMIT 1`
		)
		.get(itemId) as HistorySnapshot | undefined;

	const stats = last ? getStats(itemId, now - 7 * DAY) : EMPTY_STATS;
	const update = evaluateMarketUpdate({ itemId, bid, ask, last: last ?? null, stats });
	if (!update) return;

	db.prepare(`INSERT INTO price_history (item_id, bid, ask, ts) VALUES (?, ?, ?, ?)`).run(
		itemId,
		bid,
		ask,
		now
	);

	if (update.alert) createAlert(update.alert);
}
