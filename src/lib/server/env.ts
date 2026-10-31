import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let loaded = false;

/**
 * Load `.env.local` / `.env` for scripts and the Discord bot. SvelteKit loads
 * these itself during dev, but `process.loadEnvFile` keeps the CLI tools and
 * the bot on the same configuration without extra dependencies.
 */
function loadDotEnv(): void {
	if (loaded) return;
	loaded = true;
	for (const file of ['.env.local', '.env']) {
		const path = resolve(file);
		if (!existsSync(path)) continue;
		try {
			process.loadEnvFile(path);
		} catch {
			// A malformed env file should not take the market down.
		}
	}
}

loadDotEnv();

function num(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

export const serverEnv = {
	dbPath: resolve(process.env.MARKET_DB_PATH?.trim() || 'data/market.db'),
	appUrl: (process.env.APP_URL?.trim() || 'http://localhost:5173').replace(/\/+$/, ''),
	discordToken: process.env.DISCORD_TOKEN?.trim() ?? '',
	discordClientId: process.env.DISCORD_CLIENT_ID?.trim() ?? '',
	discordGuildId: process.env.DISCORD_GUILD_ID?.trim() ?? '',
	discordAlertChannelId: process.env.DISCORD_ALERT_CHANNEL_ID?.trim() ?? '',
	alertThresholdPct: Math.max(0.5, num(process.env.ALERT_THRESHOLD_PCT, 8)),
	alertCooldownMinutes: Math.max(1, num(process.env.ALERT_COOLDOWN_MINUTES, 45)),
	alertPollSeconds: Math.max(5, num(process.env.ALERT_POLL_SECONDS, 20)),
	wikiMarketUrl:
		process.env.WIKI_MARKET_URL?.trim() || 'https://wiki.settlers-mc.org/data/market.json',
	wikiMarketPollSeconds: Math.max(30, num(process.env.WIKI_MARKET_POLL_SECONDS, 60)),
	wikiMarketSummaryMinutes: Math.max(5, num(process.env.WIKI_MARKET_SUMMARY_MINUTES, 30)),
	wikiMarketAlertThresholdPct: Math.max(
		1,
		num(process.env.WIKI_MARKET_ALERT_THRESHOLD_PCT, 12)
	),
	wikiMarketAlertCooldownMinutes: Math.max(
		10,
		num(process.env.WIKI_MARKET_ALERT_COOLDOWN_MINUTES, 60)
	),
	supabaseUrl: (process.env.SUPABASE_URL?.trim() || '').replace(/\/+$/, ''),
	supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
	supabaseSecretKey: process.env.SUPABASE_SECRET_KEY?.trim() ?? '',
	newsModeratorKey: process.env.NEWS_MODERATOR_KEY?.trim() ?? ''
};
