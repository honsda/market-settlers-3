import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { getMeta, setMeta } from '../src/lib/server/db';
import { serverEnv } from '../src/lib/server/env';
import {
	fetchWikiMarketFeed,
	findMarketSpreads,
	type WikiPriceDeal,
	type WikiSpreadItem
} from '../src/lib/server/wiki-market';
import {
	WIKI_MARKET_PAGE,
	WIKI_STACK_SIZE,
	wikiItemLabel,
	wikiRegionLand,
	wikiRegionName,
	type WikiFeed,
	type WikiTrade
} from '../src/lib/wiki-market';
import { formatPct, formatPrice, formatQty, timeAgo } from '../src/lib/format';
import { COLORS, dashboardUrl, footer } from './format';

const DAY = 24 * 60 * 60 * 1000;
const MOVE_LIMIT = 4;

let timer: NodeJS.Timeout | null = null;
let stopped = true;
let lastNotice = 0;
const moveCooldowns = new Map<string, number>();

interface Mover {
	key: string;
	item: string;
	region: number;
	name: string;
	place: string;
	newAvg: number;
	previousAvg: number;
	changePct: number;
	qty: number;
	gold: number;
	trades: number;
}

function notice(message: string): void {
	const now = Date.now();
	if (now - lastNotice < 5 * 60_000) return;
	lastNotice = now;
	console.warn(`[bot] ${message}`);
}

function publicDashboardUrl(path = ''): string | null {
	const url = dashboardUrl(path);
	return /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/.test(url) ? null : url;
}

function placeLabel(region: number): string {
	const land = wikiRegionLand(region);
	const name = wikiRegionName(region);
	return land ? `${land} / ${name}` : name;
}

function signedGold(value: number): string {
	return `${value > 0 ? '+' : ''}${formatPrice(value)}g`;
}

function dealText(deal: WikiPriceDeal): string {
	const price = `**${formatPrice(deal.price)}g**${deal.source === 'shop' ? '' : ' (est.)'}`;
	if (deal.source !== 'shop' || deal.region === null) return `${price} at **${deal.shop}**`;
	return `${price} at **${deal.shop}** — ${placeLabel(deal.region)}`;
}

function bestShopPrice(
	feed: WikiFeed,
	item: string,
	region: number,
	side: 'buy' | 'sell'
): number | null {
	let best: number | null = null;
	for (const shop of feed.shops) {
		if (shop.item !== item || shop.region !== region || shop.side !== side) continue;
		if (shop.state !== 'open') continue;
		for (const [quantity, gold] of shop.offers) {
			if (quantity <= 0) continue;
			const each = gold / quantity;
			if (best === null || (side === 'sell' ? each < best : each > best)) best = each;
		}
	}
	return best;
}

function shopPriceLine(feed: WikiFeed, item: string, region: number): string | null {
	const ask = bestShopPrice(feed, item, region, 'sell');
	const bid = bestShopPrice(feed, item, region, 'buy');
	const parts: string[] = [];
	if (ask !== null) parts.push(`Best for sale ${formatPrice(ask)}g`);
	if (bid !== null) parts.push(`Best wanted ${formatPrice(bid)}g`);
	return parts.length ? parts.join(' · ') : null;
}

async function alertChannelId(): Promise<string> {
	return (await getMeta('bot:alert_channel_id')) || serverEnv.discordAlertChannelId;
}

async function resolveChannel(client: Client): Promise<TextChannel | null> {
	const id = await alertChannelId();
	if (!id) {
		notice('No market channel configured. Set DISCORD_ALERT_CHANNEL_ID or run /alerts in Discord.');
		return null;
	}

	try {
		const channel = await client.channels.fetch(id);
		if (!channel || !channel.isTextBased() || channel.isDMBased()) {
			notice(`Channel ${id} is not a server text channel.`);
			return null;
		}
		return channel as TextChannel;
	} catch (error) {
		notice(`Could not fetch market channel ${id}: ${error instanceof Error ? error.message : error}`);
		return null;
	}
}

function weighted(trades: WikiTrade[]): { qty: number; gold: number } {
	let qty = 0;
	let gold = 0;
	for (const trade of trades) {
		qty += trade.qty;
		gold += trade.gold;
	}
	return { qty, gold };
}

function findMovers(feed: WikiFeed, newTrades: WikiTrade[], lastTs: number): Mover[] {
	const byArea = new Map<string, { item: string; region: number; trades: WikiTrade[] }>();
	for (const trade of newTrades) {
		const key = `${trade.item}|${trade.region}`;
		const group = byArea.get(key) ?? { item: trade.item, region: trade.region, trades: [] };
		group.trades.push(trade);
		byArea.set(key, group);
	}

	const cooldownMs = serverEnv.wikiMarketAlertCooldownMinutes * 60_000;
	const cutoff = lastTs - 7 * DAY;
	const movers: Mover[] = [];

	for (const [key, group] of byArea) {
		const { item, region, trades } = group;
		const current = weighted(trades);
		if (current.qty <= 0 || current.gold <= 0) continue;

		const previous = weighted(
			feed.trades.filter(
				(trade) =>
					trade.item === item &&
					trade.region === region &&
					trade.ts <= lastTs &&
					trade.ts >= cutoff
			)
		);
		if (previous.qty <= 0 || previous.gold <= 0) continue;

		const newAvg = current.gold / current.qty;
		const previousAvg = previous.gold / previous.qty;
		if (previousAvg <= 0) continue;

		const changePct = ((newAvg - previousAvg) / previousAvg) * 100;
		if (Math.abs(changePct) < serverEnv.wikiMarketAlertThresholdPct) continue;

		const lastMove = moveCooldowns.get(key) ?? 0;
		if (Date.now() - lastMove < cooldownMs) continue;

		movers.push({
			key,
			item,
			region,
			name: wikiItemLabel(item, feed.items),
			place: placeLabel(region),
			newAvg,
			previousAvg,
			changePct,
			qty: current.qty,
			gold: current.gold,
			trades: trades.length
		});
	}

	return movers
		.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
		.slice(0, MOVE_LIMIT);
}

async function postMovers(
	client: Client,
	feed: WikiFeed,
	movers: Mover[]
): Promise<boolean> {
	if (!movers.length) return false;
	const channel = await resolveChannel(client);
	if (!channel) return false;

	const fields = movers.map((mover) => {
		const tradeLabel = mover.trades === 1 ? 'trade' : 'trades';
		const priceLine = shopPriceLine(feed, mover.item, mover.region);
		const value = [
			`${formatPct(mover.changePct)} · now ${formatPrice(mover.newAvg)}g · 7d avg ${formatPrice(mover.previousAvg)}g`,
			`${formatQty(mover.qty)} sold in ${formatQty(mover.trades)} ${tradeLabel} · ${formatPrice(mover.gold)}g traded`
		];
		if (priceLine) value.push(priceLine);
		return {
			name: `${mover.name} — ${mover.place}`,
			value: value.join('\n'),
			inline: false
		};
	});

	const dashboard = publicDashboardUrl('/market');
	fields.push({
		name: 'Feed',
		value: `${formatQty(feed.shops.length)} shops · updated ${timeAgo(feed.generated)}`,
		inline: true
	});
	if (dashboard) {
		fields.push({
			name: 'Dashboard',
			value: `[Live shop prices](${dashboard})`,
			inline: true
		});
	}

	const embed = new EmbedBuilder()
		.setColor(COLORS.ask)
		.setAuthor({ name: 'Market moves · by island/area' })
		.setTitle(`${movers.length} significant ${movers.length === 1 ? 'move' : 'moves'}`)
		.setURL(WIKI_MARKET_PAGE)
		.setDescription(
			'Compared with the previous 7-day average for the same item in the same region.'
		)
		.addFields(fields)
		.setTimestamp(new Date());

	try {
		await channel.send({ embeds: [footer(embed)] });
		const now = Date.now();
		for (const mover of movers) moveCooldowns.set(mover.key, now);
		console.log(`[bot] Posted ${movers.length} market move(s) to #${channel.name}.`);
		return true;
	} catch (error) {
		console.error(
			`[bot] Could not post market moves to #${channel.name}:`,
			error instanceof Error ? error.message : error
		);
		return false;
	}
}

async function postSummary(
	client: Client,
	feed: WikiFeed,
	trades: WikiTrade[]
): Promise<boolean> {
	const channel = await resolveChannel(client);
	if (!channel) return false;

	const groups = new Map<
		string,
		{ item: string; region: number; qty: number; gold: number; trades: number }
	>();
	for (const trade of trades) {
		const key = `${trade.item}|${trade.region}`;
		const group =
			groups.get(key) ?? { item: trade.item, region: trade.region, qty: 0, gold: 0, trades: 0 };
		group.qty += trade.qty;
		group.gold += trade.gold;
		group.trades += 1;
		groups.set(key, group);
	}

	const areaCount = groups.size;
	const ranked = [...groups.values()]
		.sort((a, b) => b.gold - a.gold || b.qty - a.qty)
		.slice(0, 10);
	const total = weighted(trades);
	const itemCount = new Set(trades.map((trade) => trade.item)).size;
	const areaNote =
		areaCount > ranked.length
			? ` · top ${formatQty(ranked.length)} of ${formatQty(areaCount)} item/area groups`
			: '';
	const itemFields = ranked.map((group) => {
		const average = group.gold / group.qty;
		const priceLine = shopPriceLine(feed, group.item, group.region);
		const tradeLabel = group.trades === 1 ? 'trade' : 'trades';
		const detail = `${formatQty(group.trades)} ${tradeLabel}`;
		return {
			name: `${wikiItemLabel(group.item, feed.items)} — ${placeLabel(group.region)}`,
			value: [
				`${formatQty(group.qty)} sold · avg ${formatPrice(average)}g · ${formatPrice(group.gold)}g traded`,
				priceLine ? `${detail} · ${priceLine}` : detail
			].join('\n'),
			inline: false
		};
	});

	const openShops = feed.shops.filter((shop) => shop.state === 'open').length;
	const latest = trades[trades.length - 1];
	const start = trades[0].ts;
	const end = latest.ts;
	itemFields.push({
		name: 'Latest trade',
		value:
			`${wikiItemLabel(latest.item, feed.items)} — ${placeLabel(latest.region)}\n` +
			`${formatQty(latest.qty)} for ${formatPrice(latest.gold)}g`,
		inline: false
	});
	itemFields.push(
		{
			name: 'Shops open',
			value: `${formatQty(openShops)} / ${formatQty(feed.shops.length)}`,
			inline: true
		},
		{
			name: 'Feed',
			value: `Updated ${timeAgo(feed.generated)}`,
			inline: true
		}
	);

	const embed = new EmbedBuilder()
		.setColor(COLORS.neutral)
		.setAuthor({ name: 'Market pulse · live shop feed' })
		.setTitle(`${formatQty(total.qty)} items sold · ${formatPrice(total.gold)}g traded`)
		.setURL(WIKI_MARKET_PAGE)
		.setDescription(
			`<t:${Math.floor(start / 1000)}:t>–<t:${Math.floor(end / 1000)}:t> · ` +
				`${formatQty(trades.length)} trades across ${formatQty(itemCount)} items${areaNote}`
		)
		.addFields(itemFields)
		.setTimestamp(new Date());

	try {
		await channel.send({ embeds: [footer(embed)] });
		console.log(`[bot] Posted market pulse to #${channel.name} (${trades.length} trades).`);
		return true;
	} catch (error) {
		console.error(
			`[bot] Could not post market pulse to #${channel.name}:`,
			error instanceof Error ? error.message : error
		);
		return false;
	}
}

async function postSpreadBoard(
	client: Client,
	feed: WikiFeed,
	items: WikiSpreadItem[]
): Promise<boolean> {
	if (!items.length) return false;
	const channel = await resolveChannel(client);
	if (!channel) return false;

	const fields = items.map((item, index) => {
		const result =
			item.profitPerItem > 0 ? 'Profit' : item.profitPerItem < 0 ? 'Loss' : 'Flat';
		const market = [
			`Market **${formatPrice(item.marketAvg)}g avg**`,
			`last **${formatPrice(item.lastPrice)}g**`,
			`${formatQty(item.sold24h)} sold / ${formatQty(item.trades24h)} trades`
		].join(' · ');
		return {
			name: `${index + 1}. ${item.name}`,
			value: [
				`Buy ${dealText(item.buy)} · Sell ${dealText(item.sell)}`,
				market,
				`**${result} ${signedGold(item.profitPerItem)}/item** · **${signedGold(item.profitPerStack)}/stack** · ${formatPct(item.marginPct)}`
			].join('\n'),
			inline: false
		};
	});

	const fewer =
		items.length < 10
			? ` Only ${items.length} ${items.length === 1 ? 'item has' : 'items have'} enough shop or market data right now.`
			: '';
	const embed = new EmbedBuilder()
		.setColor(COLORS.ask)
		.setAuthor({ name: 'Market spread board · hourly' })
		.setTitle(
			items.length >= 10
				? 'Top 10 profit & loss spreads'
				: `${items.length} profit & loss ${items.length === 1 ? 'spread' : 'spreads'}`
		)
		.setURL(WIKI_MARKET_PAGE)
		.setDescription(
			`Largest per-stack gaps in the best open-shop prices, ranked by absolute spread. ` +
				`Shop-to-shop is used when both sides are open; a missing side uses the 24h average (or last trade). ` +
				`Positive = buy-low/sell-high; negative = the shop is worse than the market. ` +
				`Stack size ${WIKI_STACK_SIZE}. Feed updated ${timeAgo(feed.generated)}.${fewer}`
		)
		.addFields(fields)
		.setTimestamp(new Date());

	try {
		await channel.send({ embeds: [footer(embed)] });
		console.log(`[bot] Posted ${items.length} market spreads to #${channel.name}.`);
		return true;
	} catch (error) {
		console.error(
			`[bot] Could not post the market spread board to #${channel.name}:`,
			error instanceof Error ? error.message : error
		);
		return false;
	}
}

async function maybePostSpreadBoard(client: Client, feed: WikiFeed): Promise<void> {
	const lastRaw = await getMeta('wiki:last_profit_at');
	const last = Number(lastRaw ?? 0) || 0;
	const interval = serverEnv.wikiMarketProfitMinutes * 60_000;
	if (last && Date.now() - last < interval) return;

	const items = findMarketSpreads(feed, 10);
	if (!items.length) {
		// No qualifying spread this hour; check again on the next interval.
		await setMeta('wiki:last_profit_at', Date.now());
		return;
	}
	if (await postSpreadBoard(client, feed, items)) {
		await setMeta('wiki:last_profit_at', Date.now());
	}
}

async function tick(client: Client): Promise<void> {
	if (stopped) return;

	try {
		const feed = await fetchWikiMarketFeed(true);
		const lastTsRaw = await getMeta('wiki:last_trade_ts');
		const lastTs = Number(lastTsRaw ?? 0) || 0;
		const maxTs = feed.trades.length ? feed.trades[feed.trades.length - 1].ts : feed.generated;

		if (!lastTs) {
			await Promise.all([
				setMeta('wiki:last_trade_ts', maxTs),
				setMeta('wiki:last_summary_at', Date.now()),
				setMeta('wiki:last_feed_generated', feed.generated),
				setMeta('wiki:last_poll_at', Date.now())
			]);
			console.log(
				`[bot] Market feed ready: ${feed.shops.length} shops, ${feed.trades.length} trades; starting from ${new Date(maxTs).toISOString()}.`
			);
			await maybePostSpreadBoard(client, feed);
			return;
		}

		const newTrades = feed.trades.filter((trade) => trade.ts > lastTs);
		await setMeta('wiki:last_feed_generated', feed.generated);
		await setMeta('wiki:last_poll_at', Date.now());
		await maybePostSpreadBoard(client, feed);

		if (!newTrades.length) return;

		const lastSummaryRaw = await getMeta('wiki:last_summary_at');
		const lastSummary = Number(lastSummaryRaw ?? 0) || 0;
		const summaryDue =
			Date.now() - lastSummary >= serverEnv.wikiMarketSummaryMinutes * 60_000;

		const movers = findMovers(feed, newTrades, lastTs);
		await postMovers(client, feed, movers);

		if (summaryDue && (await postSummary(client, feed, newTrades))) {
			await setMeta('wiki:last_summary_at', Date.now());
		}

		await setMeta('wiki:last_trade_ts', Math.max(...newTrades.map((trade) => trade.ts)));
	} catch (error) {
		notice(`Market feed watcher error: ${error instanceof Error ? error.message : error}`);
	} finally {
		if (!stopped) {
			timer = setTimeout(() => void tick(client), serverEnv.wikiMarketPollSeconds * 1000);
			timer.unref?.();
		}
	}
}

export function startWikiMarketWatcher(client: Client): void {
	if (!stopped) return;
	stopped = false;
	console.log(
		`[bot] Market feed watcher started (poll ${serverEnv.wikiMarketPollSeconds}s, ` +
			`pulse ${serverEnv.wikiMarketSummaryMinutes}m, spreads ${serverEnv.wikiMarketProfitMinutes}m, ` +
			`moves >${serverEnv.wikiMarketAlertThresholdPct}%).`
	);
	timer = setTimeout(() => void tick(client), 3_000);
	timer.unref?.();
}

export function stopWikiMarketWatcher(): void {
	stopped = true;
	if (timer) {
		clearTimeout(timer);
		timer = null;
	}
}
