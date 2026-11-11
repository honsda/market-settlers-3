import { setMeta } from '../src/lib/server/db';
import { getCurrentUser, getCurrentUserGuilds } from './discord-rest';
import { runAlertsOnce } from './watcher';
import { runNewsOnce } from './news';
import { runWikiMarketOnce } from './wiki-market';

async function recordPresence(): Promise<void> {
	await setMeta('bot:worker_last_seen', Date.now());
	const clientId = process.env.DISCORD_CLIENT_ID?.trim();
	if (clientId) await setMeta('bot:client_id', clientId);

	try {
		const user = await getCurrentUser();
		await setMeta('bot:client_id', user.id);
		await setMeta('bot:tag', user.global_name || user.username);
	} catch (error) {
		console.warn(
			'[bot] Could not read the bot user for the status page:',
			error instanceof Error ? error.message : error
		);
	}

	try {
		const guilds = await getCurrentUserGuilds();
		await setMeta('bot:guild_count', guilds.length);
	} catch {
		// Guild count is cosmetic; a missing GUILDS scope should not fail cron.
	}
}

/**
 * One Cron Trigger tick.
 *
 * When `RENDER_BOT_URL` is set, the gateway bot on Render owns the scheduled
 * posts, so this tick only pings that service. Render sleeps free web services
 * after ~15 minutes without inbound traffic; a five-minute ping keeps the
 * Discord gateway connected inside the 750 instance-hour budget. Without the
 * variable the free Worker still polls and posts everything itself, exactly as
 * before.
 *
 * Keeping every task best-effort means a missing channel or a temporary
 * Discord error never blocks the others.
 */
export async function runScheduled(): Promise<void> {
	const keepAliveUrl = process.env.RENDER_BOT_URL?.trim();
	if (keepAliveUrl) {
		await pingRender(keepAliveUrl);
		return;
	}

	await recordPresence().catch((error) => {
		console.warn(
			'[bot] Could not record Worker presence:',
			error instanceof Error ? error.message : error
		);
	});

	const results = await Promise.allSettled([
		runAlertsOnce(),
		runNewsOnce(),
		runWikiMarketOnce()
	]);

	for (const result of results) {
		if (result.status === 'rejected') {
			console.error('[bot] Scheduled task failed:', result.reason);
		}
	}
}

async function pingRender(rawUrl: string): Promise<void> {
	const url = `${rawUrl.replace(/\/+$/, '')}/health`;
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'anreu-keepalive/1.0 (+https://github.com/honsda/market-settlers-3)'
			}
		});
		// A cold start can take ~a minute; a timeout here is normal and the next
		// tick retries. Only unexpected statuses are worth logging.
		if (response.status >= 400) {
			console.warn(`[bot] Keep-alive ping to ${url} returned ${response.status}.`);
		}
	} catch (error) {
		console.warn(
			`[bot] Keep-alive ping to ${url} failed:`,
			error instanceof Error ? error.message : error
		);
	}
}
