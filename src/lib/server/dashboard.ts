import type { ItemMarket, MarketResponse, MarketSummary, Offer } from '../market';
import { getRevision, db } from './db';
import { listAlerts } from './alerts';
import { getGuilds, listOffers } from './offers';
import { computeMarket, getAllHistory, getHistory } from './market';
import { serverEnv } from './env';

function summary(open: Offer[]): MarketSummary {
	const buys = open.filter((offer) => offer.side === 'buy');
	const sells = open.filter((offer) => offer.side === 'sell');
	const now = Date.now();
	const dayAgo = now - 24 * 60 * 60 * 1000;
	const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

	const offers24h = (
		db.prepare('SELECT COUNT(*) AS count FROM offers WHERE created_at >= ?').get(dayAgo) as {
			count: number;
		}
	).count;
	const traders = (
		db
			.prepare('SELECT COUNT(DISTINCT LOWER(ign)) AS count FROM offers WHERE created_at >= ?')
			.get(weekAgo) as { count: number }
	).count;

	return {
		openBuys: buys.length,
		openSells: sells.length,
		buyQty: buys.reduce((sum, offer) => sum + offer.quantity, 0),
		sellQty: sells.reduce((sum, offer) => sum + offer.quantity, 0),
		bids: buys.length,
		asks: sells.length,
		offers24h,
		traders,
		guilds: new Set(open.map((offer) => offer.guild).filter(Boolean)).size,
		listedValue: open.reduce((sum, offer) => sum + offer.quantity * offer.price, 0)
	};
}

export function getMarketResponse(): MarketResponse {
	const open = listOffers({ status: 'open', limit: 1000 });
	const recent = listOffers({ status: 'all', limit: 10 });
	const history = getAllHistory();
	const items = computeMarket(open, history);
	const hasDemo =
		(db.prepare(`SELECT 1 AS hit FROM offers WHERE source = 'seed' LIMIT 1`).get() as
			| { hit: number }
			| undefined) !== undefined;

	return {
		offers: open,
		recent,
		items,
		alerts: listAlerts(12),
		summary: summary(open),
		guilds: getGuilds(),
		hasDemo,
		revision: getRevision(),
		serverTime: Date.now(),
		thresholdPct: serverEnv.alertThresholdPct
	};
}

export function getItemMarket(itemId: string): ItemMarket | null {
	const offers = listOffers({ status: 'open', itemId, limit: 500 });
	const history = getHistory(itemId);
	if (!offers.length && !history.length) return null;
	return computeMarket(offers, new Map([[itemId, history]]))[0] ?? null;
}
