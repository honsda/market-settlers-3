import { botConfig, requireToken } from './config';
import { registerCommands, registerWorkerCommands } from './register';

requireToken();

const gateway = process.argv.includes('--gateway');

try {
	const scope = gateway ? await registerCommands() : await registerWorkerCommands();
	console.log(`[bot] Registered ${scope}.`);
	if (gateway) {
		console.log('[bot] Registered the full gateway command set.');
	}
	if (!botConfig.guildId) {
		console.log('[bot] Global commands can take up to an hour to appear. Set DISCORD_GUILD_ID for instant updates.');
	}
} catch (error) {
	console.error('[bot] Command registration failed:', error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
