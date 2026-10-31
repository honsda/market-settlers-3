import { type Client, type TextChannel } from 'discord.js';
import { getMeta, setMeta } from '../src/lib/server/db';
import {
	listUnannouncedNews,
	markExistingNewsAnnounced,
	markNewsAnnounced
} from '../src/lib/server/news';
import { botConfig } from './config';
import { newsEmbed } from './format';

const BOOTSTRAP_KEY = 'bot:news_announce_bootstrapped';

let timer: NodeJS.Timeout | null = null;
let stopped = true;
let bootstrapped = false;
let startedAt = Date.now();
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

async function resolveChannel(client: Client): Promise<TextChannel | null> {
	const id = await newsChannelId();
	if (id) {
		try {
			const channel = await client.channels.fetch(id);
			if (channel && channel.isTextBased() && !channel.isDMBased()) {
				return channel as TextChannel;
			}
			notice(`News channel ${id} is not a server text channel.`);
		} catch (error) {
			notice(
				`Could not fetch news channel ${id}: ${error instanceof Error ? error.message : error}`
			);
		}
	}

	// No explicit ID, or the saved one was deleted: use the server's #news.
	const guilds = botConfig.guildId
		? [client.guilds.cache.get(botConfig.guildId)].filter(
				(guild): guild is NonNullable<typeof guild> => Boolean(guild)
			)
		: [...client.guilds.cache.values()];

	for (const guild of guilds) {
		const channel = guild.channels.cache.find(
			(candidate) =>
				candidate.isTextBased() &&
				!candidate.isDMBased() &&
				candidate.name.toLowerCase() === 'news'
		);
		if (!channel) continue;
		try {
			await setMeta('bot:news_channel_id', channel.id);
		} catch {
			// Finding the channel is more important than caching the ID.
		}
		return channel as TextChannel;
	}

	notice('No #news channel found. Create one or set DISCORD_NEWS_CHANNEL_ID.');
	return null;
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
		await markExistingNewsAnnounced(startedAt);
		await setMeta(BOOTSTRAP_KEY, startedAt);
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

async function tick(client: Client): Promise<void> {
	if (stopped) return;

	try {
		await ensureBootstrap();
		const pending = await listUnannouncedNews(10);
		if (!pending.length) return;

		const channel = await resolveChannel(client);
		if (!channel) return;

		let sent = 0;
		for (const article of pending) {
			if (stopped) return;
			try {
				const message = await channel.send({ embeds: [newsEmbed(article)] });
				await markNewsAnnounced(article.id);
				sent += 1;
				console.log(`[bot] Announced "${article.title}" in #${channel.name} (${message.id}).`);
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
	} catch (error) {
		console.error('[bot] News watcher error:', error instanceof Error ? error.message : error);
	} finally {
		if (!stopped) {
			timer = setTimeout(() => void tick(client), botConfig.newsPollSeconds * 1000);
			timer.unref?.();
		}
	}
}

export function startNewsWatcher(client: Client): void {
	if (!stopped) return;
	stopped = false;
	bootstrapped = false;
	startedAt = Date.now();
	// Let the ready handshake finish before the first database/channel lookup.
	timer = setTimeout(() => void tick(client), 3_000);
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
