import type { ItemMarket, MarketResponse, MarketSummary, Offer } from '../market';
import { getRevision } from './db';
import { listAlerts } from './alerts';
import { getGuilds, getOfferCounts, hasSeedOffers, listOffers } from './offers';
import type { OfferCounts } from './offers-core';
import { computeMarket, getAllHistory, getHistory } from './market';
import { serverEnv } from './env';

function summary(open: Offer[], counts: OfferCounts): MarketSummary {
	const buys = open.filter((offer) => offer.side === 'buy');
	const sells = open.filter((offer) => offer.side === 'sell');

	return {
		openBuys: buys.length,
		openSells: sells.length,
		buyQty: buys.reduce((sum, offer) => sum + offer.quantity, 0),
		sellQty: sells.reduce((sum, offer) => sum + offer.quantity, 0),
		bids: buys.length,
		asks: sells.length,
		offers24h: counts.offers24h,
		traders: counts.traders,
		guilds: new Set(open.map((offer) => offer.guild).filter(Boolean)).size,
		listedValue: open.reduce((sum, offer) => sum + offer.quantity * offer.price, 0)
	};
}

export async function getMarketResponse(): Promise<MarketResponse> {
	const [open, recent, history, alerts, guilds, counts, hasDemo, revision] = await Promise.all([
		listOffers({ status: 'open', limit: 1000 }),
		listOffers({ status: 'all', limit: 10 }),
		getAllHistory(),
		listAlerts(12),
		getGuilds(),
		getOfferCounts(),
		hasSeedOffers(),
		getRevision()
	]);
	const items = computeMarket(open, history);

	return {
		offers: open,
		recent,
		items,
		alerts,
		summary: summary(open, counts),
		guilds,
		hasDemo,
		revision,
		serverTime: Date.now(),
		thresholdPct: serverEnv.alertThresholdPct
	};
}

export async function getItemMarket(itemId: string): Promise<ItemMarket | null> {
	const [offers, history] = await Promise.all([
		listOffers({ status: 'open', itemId, limit: 500 }),
		getHistory(itemId)
	]);
	if (!offers.length && !history.length) return null;
	return computeMarket(offers, new Map([[itemId, history]]))[0] ?? null;
}
