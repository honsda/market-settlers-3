import { getMeta, setMeta } from '../src/lib/server/db';
import {
	listUnannouncedNews,
	markExistingNewsAnnounced,
	markNewsAnnounced
} from '../src/lib/server/news';
import { botConfig } from './config';
import { newsEmbed } from './format';
import {
	crosspostChannelMessage,
	getChannel,
	getGuildChannels,
	sendChannelMessage,
	type DiscordChannel
} from './discord-rest';

const BOOTSTRAP_KEY = 'bot:news_announce_bootstrapped';

let timer: NodeJS.Timeout | null = null;
let stopped = true;
let bootstrapped = false;
let lastNotice = 0;

function notice(message: string): void {
	// The watcher runs every few seconds; keep a missing channel from flooding
	// the console while it waits for someone to create #news or set the env var.
	const now = Date.now();
	if (now - lastNotice < 5 * 60_000) return;
	lastNotice = now;
	console.warn(`[bot] ${message}`);
}

async function newsChannelId(): Promise<string> {
	// An explicit env channel wins; the meta value is only the auto-discovered
	// #news channel so it survives restarts without another lookup.
	return botConfig.newsChannelId || (await getMeta('bot:news_channel_id')) || '';
}

async function resolveChannel(): Promise<DiscordChannel | null> {
	const id = await newsChannelId();
	if (id) {
		try {
			const channel = await getChannel(id);
			if (channel.type === 0 || channel.type === 5) return channel;
			notice(`News channel ${id} is not a server text channel.`);
		} catch (error) {
			notice(
				`Could not fetch news channel ${id}: ${error instanceof Error ? error.message : error}`
			);
		}
	}

	// No explicit ID, or the saved one was deleted: use the server's #news.
	if (!botConfig.guildId) {
		notice('No #news channel found. Create one or set DISCORD_NEWS_CHANNEL_ID.');
		return null;
	}

	try {
		const channels = await getGuildChannels(botConfig.guildId);
		const channel = channels.find(
			(candidate) =>
				(candidate.type === 0 || candidate.type === 5) &&
				candidate.name?.toLowerCase() === 'news'
		);
		if (!channel) {
			notice('No #news channel found. Create one or set DISCORD_NEWS_CHANNEL_ID.');
			return null;
		}
		await setMeta('bot:news_channel_id', channel.id);
		return channel;
	} catch (error) {
		notice(
			`Could not list channels for guild ${botConfig.guildId}: ${
				error instanceof Error ? error.message : error
			}`
		);
		return null;
	}
}

async function ensureBootstrap(): Promise<void> {
	if (bootstrapped) return;
	try {
		if (await getMeta(BOOTSTRAP_KEY)) {
			bootstrapped = true;
			return;
		}
		// Do not replay every article that was already published before this
		// feature shipped. Anything published after startup is still announced.
		await markExistingNewsAnnounced(Date.now());
		await setMeta(BOOTSTRAP_KEY, Date.now());
		bootstrapped = true;
		console.log('[bot] News announcements ready; existing dispatches were not re-posted.');
	} catch (error) {
		// Retry on the next tick; the bot may have started before the schema
		// migration landed in Supabase.
		throw new Error(
			`Could not initialise news announcements: ${error instanceof Error ? error.message : error}`
		);
	}
}

/** Announce every unannounced article once. Safe to call from a Cron Trigger. */
export async function runNewsOnce(): Promise<void> {
	await ensureBootstrap();
	const pending = await listUnannouncedNews(10);
	if (!pending.length) return;

	const channel = await resolveChannel();
	if (!channel) return;

	let sent = 0;
	for (const article of pending) {
		try {
			const message = await sendChannelMessage(channel.id, {
				embeds: [newsEmbed(article).toJSON()]
			});
			if (channel.type === 5) {
				await crosspostChannelMessage(channel.id, message.id).catch(() => undefined);
			}
			await markNewsAnnounced(article.id);
			sent += 1;
			console.log(`[bot] Announced "${article.title}" in #${channel.name ?? channel.id} (${message.id}).`);
		} catch (error) {
			notice(
				`Could not post news "${article.title}": ${
					error instanceof Error ? error.message : error
				}`
			);
			// Leave it unannounced; the next tick retries.
			break;
		}
	}
	if (sent) await setMeta('bot:last_news_at', Date.now());
}

async function tick(): Promise<void> {
	if (stopped) return;

	try {
		await runNewsOnce();
	} catch (error) {
		console.error('[bot] News watcher error:', error instanceof Error ? error.message : error);
	} finally {
		if (!stopped) {
			timer = setTimeout(() => void tick(), botConfig.newsPollSeconds * 1000);
			timer.unref?.();
		}
	}
}

export function startNewsWatcher(): void {
	if (!stopped) return;
	stopped = false;
	bootstrapped = false;
	// Let the host finish booting before the first database/channel lookup.
	timer = setTimeout(() => void tick(), 3_000);
	timer.unref?.();
	console.log(`[bot] News watcher started (every ${botConfig.newsPollSeconds}s).`);
}

export function stopNewsWatcher(): void {
	stopped = true;
	if (timer) {
		clearTimeout(timer);
		timer = null;
	}
}
