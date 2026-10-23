import type { PricePoint } from '../market';
import { assertOk, newId, supabase } from './db';
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
import { fetchAllRows } from './supabase-utils';

interface PriceRow {
	price: number;
	side: 'buy' | 'sell';
}

interface HistoryQueryRow {
	bid: number | null;
	ask: number | null;
	ts: number;
}

interface AllHistoryRow extends HistoryQueryRow {
	item_id: string;
}

export async function getBestPrices(
	itemId: string
): Promise<{ bid: number | null; ask: number | null }> {
	const rows = await fetchAllRows<PriceRow>(
		(from, to) =>
			supabase()
				.from('offers')
				.select('price,side')
				.eq('item_id', itemId)
				.eq('status', 'open')
				.order('id', { ascending: true })
				.range(from, to),
		'read best prices'
	);

	let bid: number | null = null;
	let ask: number | null = null;
	for (const row of rows) {
		if (row.side === 'buy') bid = bid === null ? row.price : Math.max(bid, row.price);
		else ask = ask === null ? row.price : Math.min(ask, row.price);
	}
	return { bid, ask };
}

export async function getHistory(itemId: string, days = HISTORY_DAYS): Promise<PricePoint[]> {
	const since = Date.now() - days * DAY;
	const { data, error } = await supabase()
		.from('price_history')
		.select('bid,ask,ts')
		.eq('item_id', itemId)
		.gte('ts', since)
		.order('ts', { ascending: true })
		.limit(400);
	assertOk(error, 'read price history');
	return (data ?? []).map((row: HistoryQueryRow) => ({
		ts: row.ts,
		bid: row.bid,
		ask: row.ask,
		mid: midOf(row.bid, row.ask)
	}));
}

export async function getAllHistory(days = HISTORY_DAYS): Promise<Map<string, PricePoint[]>> {
	const since = Date.now() - days * DAY;
	const rows = await fetchAllRows<AllHistoryRow>(
		(from, to) =>
			supabase()
				.from('price_history')
				.select('item_id,bid,ask,ts')
				.gte('ts', since)
				.order('ts', { ascending: true })
				.order('id', { ascending: true })
				.range(from, to),
		'read market history'
	);

	const map = new Map<string, PricePoint[]>();
	for (const row of rows) {
		const list = map.get(row.item_id) ?? [];
		list.push({ ts: row.ts, bid: row.bid, ask: row.ask, mid: midOf(row.bid, row.ask) });
		map.set(row.item_id, list);
	}
	return map;
}

async function getStats(itemId: string, since: number): Promise<HistoryStats> {
	const rows = await fetchAllRows<Pick<HistoryQueryRow, 'bid' | 'ask'>>(
		(from, to) =>
			supabase()
				.from('price_history')
				.select('bid,ask')
				.eq('item_id', itemId)
				.gte('ts', since)
				.range(from, to),
		'read price statistics'
	);

	const stats: HistoryStats = { ...EMPTY_STATS, points: rows.length };
	for (const row of rows) {
		if (row.bid !== null) {
			stats.bidMin = stats.bidMin === null ? row.bid : Math.min(stats.bidMin, row.bid);
			stats.bidMax = stats.bidMax === null ? row.bid : Math.max(stats.bidMax, row.bid);
		}
		if (row.ask !== null) {
			stats.askMin = stats.askMin === null ? row.ask : Math.min(stats.askMin, row.ask);
			stats.askMax = stats.askMax === null ? row.ask : Math.max(stats.askMax, row.ask);
		}
	}
	return stats;
}

async function createAlert(input: AlertCandidate): Promise<void> {
	const { data: recent, error: recentError } = await supabase()
		.from('alerts')
		.select('id')
		.eq('item_id', input.itemId)
		.eq('kind', input.kind)
		.gt('created_at', Date.now() - serverEnv.alertCooldownMinutes * 60_000)
		.limit(1);
	assertOk(recentError, 'check alert cooldown');
	if (recent?.length) return;

	const { error } = await supabase().from('alerts').insert({
		id: newId(),
		item_id: input.itemId,
		kind: input.kind,
		side: input.side,
		price: input.price,
		previous: input.previous,
		change_pct: input.changePct,
		message: input.message,
		created_at: Date.now()
	});
	assertOk(error, 'queue price alert');
}

export async function refreshMarketState(itemId: string): Promise<void> {
	const now = Date.now();
	const [best, lastResult] = await Promise.all([
		getBestPrices(itemId),
		supabase()
			.from('price_history')
			.select('bid,ask,ts')
			.eq('item_id', itemId)
			.order('ts', { ascending: false })
			.limit(1)
			.maybeSingle()
	]);
	assertOk(lastResult.error, 'read last price snapshot');

	const last = (lastResult.data ?? null) as HistorySnapshot | null;
	if (best.bid === null && best.ask === null) return;

	const stats = last ? await getStats(itemId, now - 7 * DAY) : EMPTY_STATS;
	const update = evaluateMarketUpdate({
		itemId,
		bid: best.bid,
		ask: best.ask,
		last,
		stats
	});
	if (!update) return;

	const { error } = await supabase().from('price_history').insert({
		item_id: itemId,
		bid: best.bid,
		ask: best.ask,
		ts: now
	});
	assertOk(error, 'write price snapshot');

	if (update.alert) await createAlert(update.alert);
}
