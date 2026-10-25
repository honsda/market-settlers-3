import type {
	WikiFeed,
	WikiItemPrice,
	WikiMarketSnapshot,
	WikiShop,
	WikiTrade
} from '../wiki-market';
import { wikiItemId, wikiItemLabel } from '../wiki-market';
import { serverEnv } from './env';

const DAY = 24 * 60 * 60 * 1000;
const CACHE_MS = 30_000;

interface RawFeed {
	version?: unknown;
	generated?: unknown;
	every?: unknown;
	since?: unknown;
	items?: unknown;
	shops?: unknown;
	trades?: unknown;
}

let feedCache: { at: number; feed: WikiFeed } | null = null;
let snapshotCache: { at: number; snapshot: WikiMarketSnapshot } | null = null;

function number(value: unknown, fallback = 0): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function normalizeShop(raw: unknown): WikiShop | null {
	if (!raw || typeof raw !== 'object') return null;
	const data = raw as Record<string, unknown>;
	const item = text(data.item);
	if (!item) return null;

	const offers: [number, number][] = [];
	if (Array.isArray(data.offers)) {
		for (const offer of data.offers) {
			if (!Array.isArray(offer) || offer.length < 2) continue;
			const quantity = number(offer[0]);
			const gold = number(offer[1]);
			if (quantity > 0 && gold >= 0) offers.push([quantity, gold]);
		}
	}

	const side = data.side === 'buy' ? 'buy' : data.side === 'sell' ? 'sell' : null;
	if (!side) return null;

	return {
		name: text(data.name, 'Shop'),
		item,
		region: number(data.region),
		side,
		stock: Math.max(0, number(data.stock)),
		state: text(data.state, 'unknown'),
		offers
	};
}

function normalizeTrade(raw: unknown): WikiTrade | null {
	if (!Array.isArray(raw) || raw.length < 6) return null;
	const rawTs = number(raw[0]);
	const ts = rawTs > 0 && rawTs < 10_000_000_000 ? rawTs * 1000 : rawTs;
	const item = text(raw[1]);
	const qty = number(raw[4]);
	const gold = number(raw[5]);
	if (!item || ts <= 0 || qty <= 0 || gold < 0) return null;

	return {
		ts,
		item,
		region: number(raw[2]),
		side: raw[3] === 'b' ? 'buy' : 'sell',
		qty,
		gold,
		shop: text(raw[6], 'Shop'),
		price: gold / qty
	};
}

function normalizeFeed(raw: RawFeed): WikiFeed {
	const items: Record<string, string> = {};
	if (raw.items && typeof raw.items === 'object') {
		for (const [key, label] of Object.entries(raw.items as Record<string, unknown>)) {
			if (typeof label === 'string') items[key] = label;
		}
	}

	const shops = Array.isArray(raw.shops)
		? raw.shops.map(normalizeShop).filter((shop): shop is WikiShop => shop !== null)
		: [];

	const trades = Array.isArray(raw.trades)
		? raw.trades
				.map(normalizeTrade)
				.filter((trade): trade is WikiTrade => trade !== null)
				.sort((a, b) => a.ts - b.ts)
		: [];

	return {
		version: number(raw.version, 1),
		generated: number(raw.generated, Date.now()),
		every: Math.max(1, number(raw.every, 60)),
		since: text(raw.since),
		items,
		shops,
		trades
	};
}

export async function fetchWikiMarketFeed(force = false): Promise<WikiFeed> {
	if (!force && feedCache && Date.now() - feedCache.at < CACHE_MS) return feedCache.feed;

	const response = await fetch(serverEnv.wikiMarketUrl, {
		headers: {
			accept: 'application/json',
			'user-agent': 'SettlersMarket/1.0 (+https://wiki.settlers-mc.org/market.html)'
		},
		signal: AbortSignal.timeout(15_000)
	});
	if (!response.ok) throw new Error(`Market feed returned HTTP ${response.status}.`);

	const raw = (await response.json()) as RawFeed;
	const feed = normalizeFeed(raw);
	feedCache = { at: Date.now(), feed };
	return feed;
}

function bestOffer(shop: WikiShop): number | null {
	let best: number | null = null;
	for (const [quantity, gold] of shop.offers) {
		if (quantity <= 0) continue;
		const each = gold / quantity;
		if (best === null || (shop.side === 'sell' ? each < best : each > best)) best = each;
	}
	return best;
}

function bestShop(
	shops: WikiShop[],
	side: 'buy' | 'sell'
): { price: number; region: number } | null {
	let best: { price: number; region: number } | null = null;
	for (const shop of shops) {
		const price = bestOffer(shop);
		if (price === null) continue;
		if (!best || (side === 'sell' ? price < best.price : price > best.price)) {
			best = { price, region: shop.region };
		}
	}
	return best;
}

function weightedAverage(trades: WikiTrade[]): number | null {
	let gold = 0;
	let quantity = 0;
	for (const trade of trades) {
		gold += trade.gold;
		quantity += trade.qty;
	}
	return quantity > 0 ? gold / quantity : null;
}

export function buildWikiMarketSnapshot(
	feed: WikiFeed,
	now = Date.now()
): WikiMarketSnapshot {
	const reference = feed.generated || now;
	const cutoff24 = reference - DAY;
	const cutoff48 = reference - 2 * DAY;
	const cutoff7 = reference - 7 * DAY;

	const keys = new Set<string>([
		...Object.keys(feed.items),
		...feed.shops.map((shop) => shop.item),
		...feed.trades.map((trade) => trade.item)
	]);

	const items: WikiItemPrice[] = [];
	for (const key of keys) {
		const shops = feed.shops.filter((shop) => shop.item === key);
		const openSellShops = shops.filter((shop) => shop.side === 'sell' && shop.state === 'open');
		const openBuyShops = shops.filter((shop) => shop.side === 'buy' && shop.state === 'open');
		const bestAsk = bestShop(openSellShops, 'sell');
		const bestBid = bestShop(openBuyShops, 'buy');

		const trades = feed.trades.filter((trade) => trade.item === key);
		const trades24h = trades.filter((trade) => trade.ts >= cutoff24);
		const previous24h = trades.filter((trade) => trade.ts >= cutoff48 && trade.ts < cutoff24);
		const trades7d = trades.filter((trade) => trade.ts >= cutoff7);
		const last = trades.length ? trades[trades.length - 1] : null;

		const avg24h = weightedAverage(trades24h);
		const previousAvg = weightedAverage(previous24h);
		const changePct =
			avg24h !== null && previousAvg !== null && previousAvg > 0
				? ((avg24h - previousAvg) / previousAvg) * 100
				: null;

		items.push({
			key,
			itemId: wikiItemId(key),
			name: wikiItemLabel(key, feed.items),
			bestBid: bestBid?.price ?? null,
			bestAsk: bestAsk?.price ?? null,
			bestBidRegion: bestBid?.region ?? null,
			bestAskRegion: bestAsk?.region ?? null,
			bidShops: openBuyShops.length,
			askShops: openSellShops.length,
			stock: openSellShops.reduce((sum, shop) => sum + shop.stock, 0),
			lastPrice: last?.price ?? null,
			lastTradeAt: last?.ts ?? null,
			avg24h,
			sold24h: trades24h.reduce((sum, trade) => sum + trade.qty, 0),
			gold24h: trades24h.reduce((sum, trade) => sum + trade.gold, 0),
			trades24h: trades24h.length,
			avg7d: weightedAverage(trades7d),
			sold7d: trades7d.reduce((sum, trade) => sum + trade.qty, 0),
			gold7d: trades7d.reduce((sum, trade) => sum + trade.gold, 0),
			trades7d: trades7d.length,
			changePct
		});
	}

	items.sort((a, b) => b.gold24h - a.gold24h || b.sold24h - a.sold24h || a.name.localeCompare(b.name));

	const openShops = feed.shops.filter((shop) => shop.state === 'open');
	const openSellShops = openShops.filter((shop) => shop.side === 'sell');
	const itemsForSaleKinds = new Set(
		openSellShops.filter((shop) => shop.stock > 0).map((shop) => shop.item)
	).size;

	const trades24h = feed.trades.filter((trade) => trade.ts >= cutoff24);
	const activeItems24h = new Set(trades24h.map((trade) => trade.item)).size;

	const topMovers = items
		.filter((item) => item.changePct !== null && item.trades24h >= 2)
		.sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
		.slice(0, 6);

	return {
		generated: feed.generated,
		every: feed.every,
		since: feed.since,
		fetchedAt: now,
		shopsOpen: openShops.length,
		shopsTotal: feed.shops.length,
		itemsForSale: openSellShops.reduce((sum, shop) => sum + shop.stock, 0),
		itemsForSaleKinds,
		itemsSold24h: trades24h.reduce((sum, trade) => sum + trade.qty, 0),
		goldTraded24h: trades24h.reduce((sum, trade) => sum + trade.gold, 0),
		trades24h: trades24h.length,
		activeItems24h,
		items,
		recentTrades: feed.trades.slice(-12).reverse(),
		topMovers
	};
}

export async function getWikiMarketSnapshot(force = false): Promise<WikiMarketSnapshot> {
	if (!force && snapshotCache && Date.now() - snapshotCache.at < CACHE_MS) {
		return snapshotCache.snapshot;
	}
	const feed = await fetchWikiMarketFeed(force);
	const snapshot = buildWikiMarketSnapshot(feed);
	snapshotCache = { at: Date.now(), snapshot };
	return snapshot;
}
