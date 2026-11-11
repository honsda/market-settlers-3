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
 * One Cron Trigger tick. The free Worker has no long-lived gateway process, so
 * each scheduled invocation polls the shared database once and posts anything
 * that is due. Keeping every task best-effort means a missing channel or a
 * temporary Discord error never blocks the others.
 */
export async function runScheduled(): Promise<void> {
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
