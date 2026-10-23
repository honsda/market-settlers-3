import { botConfig, requireToken } from './config';
import { registerCommands } from './register';

requireToken();

try {
	const scope = await registerCommands();
	console.log(`[bot] Registered ${scope}.`);
	if (!botConfig.guildId) {
		console.log('[bot] Global commands can take up to an hour to appear. Set DISCORD_GUILD_ID for instant updates.');
	}
} catch (error) {
	console.error('[bot] Command registration failed:', error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
