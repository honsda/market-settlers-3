import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { getMeta, setMeta } from '../src/lib/server/db';
import { serverEnv } from '../src/lib/server/env';
import { fetchWikiMarketFeed } from '../src/lib/server/wiki-market';
import {
	WIKI_MARKET_PAGE,
	wikiItemLabel,
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
	name: string;
	newAvg: number;
	previousAvg: number;
	changePct: number;
	qty: number;
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
	const byItem = new Map<string, WikiTrade[]>();
	for (const trade of newTrades) {
		const list = byItem.get(trade.item) ?? [];
		list.push(trade);
		byItem.set(trade.item, list);
	}

	const cooldownMs = serverEnv.wikiMarketAlertCooldownMinutes * 60_000;
	const cutoff = lastTs - 7 * DAY;
	const movers: Mover[] = [];

	for (const [key, trades] of byItem) {
		const current = weighted(trades);
		if (current.qty <= 0 || current.gold <= 0) continue;

		const previous = weighted(
			feed.trades.filter(
				(trade) => trade.item === key && trade.ts <= lastTs && trade.ts >= cutoff
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
			name: wikiItemLabel(key, feed.items),
			newAvg,
			previousAvg,
			changePct,
			qty: current.qty,
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

	const fields = [
		{
			name: 'Feed',
			value: `${formatQty(feed.shops.length)} shops · updated ${timeAgo(feed.generated)}`,
			inline: true
		}
	];
	const dashboard = publicDashboardUrl('/market');
	if (dashboard) {
		fields.push({
			name: 'Dashboard',
			value: `[Live shop prices](${dashboard})`,
			inline: true
		});
	}

	const embed = new EmbedBuilder()
		.setColor(COLORS.ask)
		.setAuthor({ name: 'Market moves · live shop feed' })
		.setTitle(`${movers.length} significant ${movers.length === 1 ? 'move' : 'moves'}`)
		.setURL(WIKI_MARKET_PAGE)
		.setDescription(
			movers
				.map((mover) => {
					const tradeLabel = mover.trades === 1 ? 'trade' : 'trades';
					return (
						`**${mover.name}** · ${formatPct(mover.changePct)} to **${formatPrice(mover.newAvg)}g** ` +
						`(7d avg ${formatPrice(mover.previousAvg)}g) · ${formatQty(mover.qty)} sold in ` +
						`${formatQty(mover.trades)} ${tradeLabel}`
					);
				})
				.join('\n')
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

	const groups = new Map<string, { qty: number; gold: number; trades: number }>();
	for (const trade of trades) {
		const group = groups.get(trade.item) ?? { qty: 0, gold: 0, trades: 0 };
		group.qty += trade.qty;
		group.gold += trade.gold;
		group.trades += 1;
		groups.set(trade.item, group);
	}

	const ranked = [...groups.entries()]
		.sort((a, b) => b[1].gold - a[1].gold || b[1].qty - a[1].qty)
		.slice(0, 6);
	const total = weighted(trades);
	const lines = ranked.map(([key, group]) => {
		const average = group.gold / group.qty;
		return (
			`**${wikiItemLabel(key, feed.items)}** · ${formatQty(group.qty)} sold · ` +
			`avg ${formatPrice(average)}g · ${formatQty(group.trades)} ${group.trades === 1 ? 'trade' : 'trades'}`
		);
	});

	const openShops = feed.shops.filter((shop) => shop.state === 'open').length;
	const start = trades[0].ts;
	const end = trades[trades.length - 1].ts;
	const embed = new EmbedBuilder()
		.setColor(COLORS.neutral)
		.setAuthor({ name: 'Market pulse · live shop feed' })
		.setTitle(`${formatQty(total.qty)} items sold · ${formatPrice(total.gold)}g traded`)
		.setURL(WIKI_MARKET_PAGE)
		.setDescription(
			lines.length
				? `${lines.join('\n')}\n\nLatest: **${wikiItemLabel(trades[trades.length - 1].item, feed.items)}** · ` +
						`${formatQty(trades[trades.length - 1].qty)} for ${formatPrice(trades[trades.length - 1].gold)}g`
				: 'No shop trades in this window.'
		)
		.addFields(
			{
				name: 'Period',
				value: `<t:${Math.floor(start / 1000)}:t>–<t:${Math.floor(end / 1000)}:t>`,
				inline: true
			},
			{
				name: 'Activity',
				value: `${formatQty(trades.length)} trades · ${formatQty(groups.size)} items`,
				inline: true
			},
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
		)
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
			return;
		}

		const newTrades = feed.trades.filter((trade) => trade.ts > lastTs);
		await setMeta('wiki:last_feed_generated', feed.generated);
		await setMeta('wiki:last_poll_at', Date.now());

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
			`pulse ${serverEnv.wikiMarketSummaryMinutes}m, moves >${serverEnv.wikiMarketAlertThresholdPct}%).`
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
