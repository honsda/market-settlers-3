import type { PricePoint } from '../market';
import { usingSupabase } from './db';
import * as sqlite from './market-sqlite';
import * as supabaseBackend from './market-supabase';
import { HISTORY_DAYS } from './market-core';

export {
	DAY,
	HISTORY_DAYS,
	EMPTY_STATS,
	computeMarket,
	evaluateMarketUpdate,
	midOf,
	type AlertCandidate,
	type HistorySnapshot,
	type HistoryStats,
	type OfferForStats
} from './market-core';

export async function getBestPrices(
	itemId: string
): Promise<{ bid: number | null; ask: number | null }> {
	return usingSupabase
		? supabaseBackend.getBestPrices(itemId)
		: sqlite.getBestPrices(itemId);
}

export async function getHistory(itemId: string, days = HISTORY_DAYS): Promise<PricePoint[]> {
	return usingSupabase
		? supabaseBackend.getHistory(itemId, days)
		: sqlite.getHistory(itemId, days);
}

export async function getAllHistory(days = HISTORY_DAYS): Promise<Map<string, PricePoint[]>> {
	return usingSupabase
		? supabaseBackend.getAllHistory(days)
		: sqlite.getAllHistory(days);
}

export async function refreshMarketState(itemId: string): Promise<void> {
	if (usingSupabase) {
		await supabaseBackend.refreshMarketState(itemId);
		return;
	}
	sqlite.refreshMarketState(itemId);
}
