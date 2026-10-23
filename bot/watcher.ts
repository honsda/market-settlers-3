import { type Client, type TextChannel } from 'discord.js';
import { getPendingAlerts, markAlertPosted } from '../src/lib/server/alerts';
import { getItem } from '../src/lib/market';
import { getMeta, setMeta } from '../src/lib/server/db';
import { botConfig } from './config';
import { alertEmbed } from './format';

let timer: NodeJS.Timeout | null = null;
let stopped = true;
let lastNotice = 0;

function alertChannelId(): string {
	return getMeta('bot:alert_channel_id') || botConfig.alertChannelId;
}

function notice(message: string): void {
	// Avoid spamming the console every poll while no channel is configured.
	const now = Date.now();
	if (now - lastNotice < 5 * 60_000) return;
	lastNotice = now;
	console.warn(`[bot] ${message}`);
}

async function resolveChannel(client: Client): Promise<TextChannel | null> {
	const id = alertChannelId();
	if (!id) {
		notice('No alert channel configured. Run /alerts in Discord or set DISCORD_ALERT_CHANNEL_ID.');
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
		notice(`Could not fetch alert channel ${id}: ${error instanceof Error ? error.message : error}`);
		return null;
	}
}

async function tick(client: Client): Promise<void> {
	if (stopped) return;

	try {
		const pending = getPendingAlerts(10);
		if (pending.length) {
			const channel = await resolveChannel(client);
			if (channel) {
				for (const alert of pending) {
					if (stopped) return;
					try {
						const message = await channel.send({
							embeds: [alertEmbed(alert, getItem(alert.itemId))]
						});
						markAlertPosted(alert.id, message.id);
					} catch (error) {
						console.error(
							`[bot] Failed to post alert ${alert.id}:`,
							error instanceof Error ? error.message : error
						);
						// Leave it pending; the next tick retries.
						break;
					}
				}
				if (pending.length) setMeta('bot:last_alert_at', Date.now());
			}
		}
	} catch (error) {
		console.error('[bot] Alert watcher error:', error instanceof Error ? error.message : error);
	} finally {
		if (!stopped) {
			timer = setTimeout(() => void tick(client), botConfig.pollSeconds * 1000);
			timer.unref?.();
		}
	}
}

export function startAlertWatcher(client: Client): void {
	if (!stopped) return;
	stopped = false;
	// Give the client a moment to finish its ready handshake before the first poll.
	timer = setTimeout(() => void tick(client), 2_500);
	timer.unref?.();
	console.log(`[bot] Alert watcher started (every ${botConfig.pollSeconds}s).`);
}

export function stopAlertWatcher(): void {
	stopped = true;
	if (timer) {
		clearTimeout(timer);
		timer = null;
	}
}
