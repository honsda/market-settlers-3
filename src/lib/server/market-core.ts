import { getItem, type ItemMarket, type PricePoint, type Side } from '../market';
import { formatPrice } from '../format';
import { serverEnv } from './env';

export const HISTORY_DAYS = 21;
export const DAY = 24 * 60 * 60 * 1000;

export function midOf(bid: number | null, ask: number | null): number | null {
	if (bid !== null && ask !== null) return (bid + ask) / 2;
	return bid ?? ask ?? null;
}

export interface OfferForStats {
	side: Side;
	quantity: number;
	price: number;
	itemId: string;
	createdAt: number;
	updatedAt: number;
}

/** Compute the order-book view for every item that has offers or price history. */
export function computeMarket(
	offers: OfferForStats[],
	historyByItem: Map<string, PricePoint[]>,
	now = Date.now()
): ItemMarket[] {
	const grouped = new Map<string, OfferForStats[]>();
	for (const offer of offers) {
		const list = grouped.get(offer.itemId) ?? [];
		list.push(offer);
		grouped.set(offer.itemId, list);
	}

	const ids = new Set<string>([...grouped.keys(), ...historyByItem.keys()]);
	const result: ItemMarket[] = [];

	for (const itemId of ids) {
		const itemOffers = grouped.get(itemId) ?? [];
		const buys = itemOffers.filter((o) => o.side === 'buy');
		const sells = itemOffers.filter((o) => o.side === 'sell');

		const bestBid = buys.length ? Math.max(...buys.map((o) => o.price)) : null;
		const bestAsk = sells.length ? Math.min(...sells.map((o) => o.price)) : null;
		const bidQty = buys.filter((o) => o.price === bestBid).reduce((sum, o) => sum + o.quantity, 0);
		const askQty = sells.filter((o) => o.price === bestAsk).reduce((sum, o) => sum + o.quantity, 0);
		const bidQtyTotal = buys.reduce((sum, o) => sum + o.quantity, 0);
		const askQtyTotal = sells.reduce((sum, o) => sum + o.quantity, 0);
		const mid = midOf(bestBid, bestAsk);
		const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
		const spreadPct = spread !== null && mid ? (spread / mid) * 100 : null;

		const history = (historyByItem.get(itemId) ?? []).slice(-200);
		const base = history.find((point) => point.ts <= now - DAY && point.mid !== null);
		const changePct =
			base && base.mid && mid !== null && base.mid > 0 ? ((mid - base.mid) / base.mid) * 100 : null;

		const lastUpdated = itemOffers.length
			? Math.max(...itemOffers.map((o) => o.updatedAt))
			: null;

		result.push({
			itemId,
			bestBid,
			bestAsk,
			bidQty,
			askQty,
			bidQtyTotal,
			askQtyTotal,
			bidCount: buys.length,
			askCount: sells.length,
			mid,
			spread,
			spreadPct,
			changePct,
			history,
			lastUpdated
		});
	}

	return result.sort((a, b) => {
		const aValue = (a.bestBid ?? 0) * a.bidQtyTotal + (a.bestAsk ?? 0) * a.askQtyTotal;
		const bValue = (b.bestBid ?? 0) * b.bidQtyTotal + (b.bestAsk ?? 0) * b.askQtyTotal;
		if (bValue !== aValue) return bValue - aValue;
		const aName = getItem(a.itemId)?.name ?? a.itemId;
		const bName = getItem(b.itemId)?.name ?? b.itemId;
		return aName.localeCompare(bName);
	});
}

export interface HistorySnapshot {
	bid: number | null;
	ask: number | null;
	ts: number;
}

export interface HistoryStats {
	bidMin: number | null;
	bidMax: number | null;
	askMin: number | null;
	askMax: number | null;
	points: number;
}

export const EMPTY_STATS: HistoryStats = {
	bidMin: null,
	bidMax: null,
	askMin: null,
	askMax: null,
	points: 0
};

export interface AlertCandidate {
	itemId: string;
	kind: 'price-up' | 'price-down' | 'new-high' | 'new-low';
	side: Side;
	price: number;
	previous: number | null;
	changePct: number | null;
	message: string;
}

/**
 * Decide whether a best-price change should be recorded and whether it should
 * queue a Discord alert. Pure function shared by the SQLite and Supabase
 * backends.
 */
export function evaluateMarketUpdate(input: {
	itemId: string;
	bid: number | null;
	ask: number | null;
	last: HistorySnapshot | null;
	stats: HistoryStats;
}): { alert: AlertCandidate | null } | null {
	const { itemId, bid, ask, last, stats } = input;
	if (bid === null && ask === null) return null;
	if (last && last.bid === bid && last.ask === ask) return null;

	if (!last) return { alert: null };

	const item = getItem(itemId);
	const name = item?.name ?? itemId;

	type Move = {
		side: Side;
		price: number;
		previous: number;
		pct: number;
		kind: 'price-up' | 'price-down';
	};
	const moves: Move[] = [];

	if (bid !== null && last.bid !== null && bid !== last.bid) {
		const pct = ((bid - last.bid) / last.bid) * 100;
		moves.push({
			side: 'buy',
			price: bid,
			previous: last.bid,
			pct,
			kind: pct > 0 ? 'price-up' : 'price-down'
		});
	}
	if (ask !== null && last.ask !== null && ask !== last.ask) {
		const pct = ((ask - last.ask) / last.ask) * 100;
		moves.push({
			side: 'sell',
			price: ask,
			previous: last.ask,
			pct,
			kind: pct > 0 ? 'price-up' : 'price-down'
		});
	}

	const largest = moves.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
	if (largest && Math.abs(largest.pct) >= serverEnv.alertThresholdPct) {
		const direction = largest.kind === 'price-up' ? 'jumped' : 'dropped';
		const label = largest.side === 'buy' ? 'Best buy order' : 'Best sell offer';
		return {
			alert: {
				itemId,
				kind: largest.kind,
				side: largest.side,
				price: largest.price,
				previous: largest.previous,
				changePct: largest.pct,
				message: `${label} for ${name} ${direction} ${Math.abs(largest.pct).toFixed(1)}% to ${formatPrice(
					largest.price
				)} coins (was ${formatPrice(largest.previous)}).`
			}
		};
	}

	if (stats.points < 3) return { alert: null };

	type Extreme = {
		side: Side;
		kind: 'new-high' | 'new-low';
		price: number;
		previous: number;
		pct: number;
	};
	const extremes: Extreme[] = [];

	if (bid !== null && stats.bidMax !== null && stats.bidMax > 0 && bid > stats.bidMax * 1.015) {
		extremes.push({
			side: 'buy',
			kind: 'new-high',
			price: bid,
			previous: stats.bidMax,
			pct: ((bid - stats.bidMax) / stats.bidMax) * 100
		});
	}
	if (ask !== null && stats.askMin !== null && stats.askMin > 0 && ask < stats.askMin * 0.985) {
		extremes.push({
			side: 'sell',
			kind: 'new-low',
			price: ask,
			previous: stats.askMin,
			pct: ((ask - stats.askMin) / stats.askMin) * 100
		});
	}
	if (bid !== null && stats.bidMin !== null && stats.bidMin > 0 && bid < stats.bidMin * 0.985) {
		extremes.push({
			side: 'buy',
			kind: 'new-low',
			price: bid,
			previous: stats.bidMin,
			pct: ((bid - stats.bidMin) / stats.bidMin) * 100
		});
	}
	if (ask !== null && stats.askMax !== null && stats.askMax > 0 && ask > stats.askMax * 1.015) {
		extremes.push({
			side: 'sell',
			kind: 'new-high',
			price: ask,
			previous: stats.askMax,
			pct: ((ask - stats.askMax) / stats.askMax) * 100
		});
	}

	const extreme = extremes.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
	if (!extreme) return { alert: null };
	const sideLabel = extreme.side === 'buy' ? 'buy' : 'sell';
	const kindLabel = extreme.kind === 'new-high' ? '7-day high' : '7-day low';
	return {
		alert: {
			itemId,
			kind: extreme.kind,
			side: extreme.side,
			price: extreme.price,
			previous: extreme.previous,
			changePct: extreme.pct,
			message: `New ${kindLabel} for ${name} ${sideLabel} offers: ${formatPrice(
				extreme.price
			)} coins (was ${formatPrice(extreme.previous)}).`
		}
	};
}
