import { getPendingAlerts, markAlertPosted } from '../src/lib/server/alerts';
import { getItem } from '../src/lib/market';
import { getMeta, setMeta } from '../src/lib/server/db';
import { botConfig } from './config';
import { alertEmbed } from './format';
import {
	crosspostChannelMessage,
	getChannel,
	sendChannelMessage,
	type DiscordChannel
} from './discord-rest';

let timer: NodeJS.Timeout | null = null;
let stopped = true;
let lastNotice = 0;

async function alertChannelId(): Promise<string> {
	return (await getMeta('bot:alert_channel_id')) || botConfig.alertChannelId;
}

function notice(message: string): void {
	// Avoid spamming the console every poll while no channel is configured.
	const now = Date.now();
	if (now - lastNotice < 5 * 60_000) return;
	lastNotice = now;
	console.warn(`[bot] ${message}`);
}

async function resolveChannel(): Promise<DiscordChannel | null> {
	const id = await alertChannelId();
	if (!id) {
		notice('No alert channel configured. Run /alerts in Discord or set DISCORD_ALERT_CHANNEL_ID.');
		return null;
	}

	try {
		const channel = await getChannel(id);
		if (channel.type !== 0 && channel.type !== 5) {
			notice(`Channel ${id} is not a server text or announcement channel.`);
			return null;
		}
		return channel;
	} catch (error) {
		notice(`Could not fetch alert channel ${id}: ${error instanceof Error ? error.message : error}`);
		return null;
	}
}

/** Post every pending market alert once. Safe to call from a Cron Trigger. */
export async function runAlertsOnce(): Promise<void> {
	const pending = await getPendingAlerts(10);
	if (!pending.length) return;

	const channel = await resolveChannel();
	if (!channel) return;

	for (const alert of pending) {
		try {
			const message = await sendChannelMessage(channel.id, {
				embeds: [alertEmbed(alert, getItem(alert.itemId)).toJSON()]
			});
			if (channel.type === 5) {
				await crosspostChannelMessage(channel.id, message.id).catch((error) => {
					console.warn(
						`[bot] Could not publish alert ${alert.id} to followers:`,
						error instanceof Error ? error.message : error
					);
				});
			}
			await markAlertPosted(alert.id, message.id);
		} catch (error) {
			console.error(
				`[bot] Failed to post alert ${alert.id}:`,
				error instanceof Error ? error.message : error
			);
			// Leave it pending; the next tick retries.
			break;
		}
	}

	await setMeta('bot:last_alert_at', Date.now());
}

async function tick(): Promise<void> {
	if (stopped) return;

	try {
		await runAlertsOnce();
	} catch (error) {
		console.error('[bot] Alert watcher error:', error instanceof Error ? error.message : error);
	} finally {
		if (!stopped) {
			timer = setTimeout(() => void tick(), botConfig.pollSeconds * 1000);
			timer.unref?.();
		}
	}
}

export function startAlertWatcher(): void {
	if (!stopped) return;
	stopped = false;
	// Give the host a moment to finish booting before the first poll.
	timer = setTimeout(() => void tick(), 2_500);
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
