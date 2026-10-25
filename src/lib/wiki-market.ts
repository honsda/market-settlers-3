import { getItem, type Item } from './market';

/**
 * Shared types and helpers for the official Settlers III market feed.
 *
 * The wiki market page reads `https://wiki.settlers-mc.org/data/market.json`.
 * Prices in that feed are gold nuggets per item; the feed bundles small items
 * (for example 8 wheat for 2 nuggets), so every price exposed here is already
 * divided by the bundle quantity.
 */
export const WIKI_MARKET_PAGE = 'https://wiki.settlers-mc.org/market.html';
export const WIKI_MARKET_FEED = 'https://wiki.settlers-mc.org/data/market.json';

export const WIKI_REGIONS: Record<number, { name: string; land: string }> = {
	1: { name: 'Fearnmuir', land: 'Outer Isles' },
	2: { name: 'Dunbarra', land: 'Outer Isles' },
	15: { name: 'The Burning Isle', land: 'Outer Isles' },
	3: { name: 'Ardveil', land: 'Northlands' },
	4: { name: 'Dùnross', land: 'Northlands' },
	5: { name: 'Sgorrachan', land: 'Northlands' },
	14: { name: 'Ardcarran', land: 'Northlands' },
	6: { name: 'Ruannis', land: 'Spiderholme Isles' },
	7: { name: 'Maigor', land: 'Spiderholme Isles' },
	8: { name: 'Cannoch', land: 'Spiderholme Isles' },
	9: { name: 'Colvane', land: 'Breadbasket' },
	10: { name: 'Tirwenn', land: 'Breadbasket' },
	11: { name: 'Morvethan', land: 'Rainlands' },
	12: { name: 'Ionfarr', land: 'Rainlands' },
	13: { name: 'Ardnamor', land: 'Rainlands' }
};

export function wikiRegionName(id: number): string {
	return WIKI_REGIONS[id]?.name ?? 'Elsewhere';
}

export function wikiRegionLand(id: number): string | null {
	return WIKI_REGIONS[id]?.land ?? null;
}

/** `minecraft:oak_log#some variant` → `oak_log`. */
export function wikiItemBase(key: string): string {
	return key.split('#')[0].replace(/^minecraft:/, '');
}

/** Map a feed key to our curated catalogue id, when one exists. */
export function wikiItemId(key: string): string | null {
	const base = wikiItemBase(key);
	return getItem(base) ? base : null;
}

export function wikiItem(key: string): Item | undefined {
	const id = wikiItemId(key);
	return id ? getItem(id) : undefined;
}

export function wikiItemLabel(key: string, labels: Record<string, string> = {}): string {
	const label = labels[key];
	if (label) return label;
	return wikiItemBase(key)
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export interface WikiShop {
	name: string;
	item: string;
	region: number;
	side: 'buy' | 'sell';
	stock: number;
	state: string;
	/** [quantity, gold paid] bundles. */
	offers: [quantity: number, gold: number][];
}

export interface WikiTrade {
	/** Unix milliseconds. */
	ts: number;
	item: string;
	region: number;
	side: 'buy' | 'sell';
	qty: number;
	gold: number;
	shop: string;
	/** Gold nuggets per item. */
	price: number;
}

export interface WikiFeed {
	version: number;
	/** Unix milliseconds. */
	generated: number;
	every: number;
	since: string;
	items: Record<string, string>;
	shops: WikiShop[];
	trades: WikiTrade[];
}

export interface WikiItemPrice {
	key: string;
	itemId: string | null;
	name: string;
	bestBid: number | null;
	bestAsk: number | null;
	bestBidRegion: number | null;
	bestAskRegion: number | null;
	bidShops: number;
	askShops: number;
	stock: number;
	lastPrice: number | null;
	lastTradeAt: number | null;
	avg24h: number | null;
	sold24h: number;
	gold24h: number;
	trades24h: number;
	avg7d: number | null;
	sold7d: number;
	gold7d: number;
	trades7d: number;
	/** 24h average vs. the preceding 24h average. */
	changePct: number | null;
}

export interface WikiMarketSnapshot {
	generated: number;
	every: number;
	since: string;
	fetchedAt: number;
	shopsOpen: number;
	shopsTotal: number;
	/** Units currently held by open selling shops. */
	itemsForSale: number;
	itemsForSaleKinds: number;
	itemsSold24h: number;
	goldTraded24h: number;
	trades24h: number;
	activeItems24h: number;
	items: WikiItemPrice[];
	recentTrades: WikiTrade[];
	topMovers: WikiItemPrice[];
}
