import {
	ActivityType,
	Client,
	Events,
	GatewayIntentBits,
	MessageFlags,
	type Interaction
} from 'discord.js';
import { botConfig, requireToken } from './config';
import { handleAutocomplete, handleButton, handleCommand } from './commands';
import { registerCommands } from './register';
import { startAlertWatcher, stopAlertWatcher } from './watcher';
import { getMeta, setMeta } from '../src/lib/server/db';
import { serverEnv } from '../src/lib/server/env';

const token = requireToken();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let heartbeat: NodeJS.Timeout | null = null;
let shuttingDown = false;

async function beat(): Promise<void> {
	if (shuttingDown) return;
	try {
		await setMeta('bot:last_seen', Date.now());
		if (client.user) {
			await setMeta('bot:tag', client.user.tag);
			await setMeta('bot:client_id', client.user.id);
		}
		if (client.isReady()) await setMeta('bot:guild_count', client.guilds.cache.size);
	} catch (error) {
		console.error('[bot] Heartbeat failed:', error instanceof Error ? error.message : error);
	}
}

function startHeartbeat(): void {
	void beat();
	if (heartbeat) clearInterval(heartbeat);
	heartbeat = setInterval(() => void beat(), 20_000);
	heartbeat.unref?.();
}

client.once(Events.ClientReady, async (readyClient) => {
	console.log(`[bot] Signed in as ${readyClient.user.tag} (${readyClient.guilds.cache.size} servers).`);
	console.log(`[bot] Dashboard: ${serverEnv.appUrl}`);
	console.log(
		`[bot] Alerts: >${botConfig.thresholdPct}% moves, cooldown ${serverEnv.alertCooldownMinutes}m, poll ${botConfig.pollSeconds}s.`
	);

	readyClient.user.setPresence({
		status: 'online',
		activities: [{ name: 'the Settlers III market', type: ActivityType.Watching }]
	});

	startHeartbeat();
	startAlertWatcher(client);

	try {
		const scope = await registerCommands();
		console.log(`[bot] Slash commands ready: ${scope}.`);
	} catch (error) {
		console.error(
			'[bot] Could not register slash commands:',
			error instanceof Error ? error.message : error
		);
		console.error('[bot] Run `npm run bot:deploy` after checking DISCORD_CLIENT_ID / DISCORD_GUILD_ID.');
	}

	if (!(await getMeta('bot:alert_channel_id')) && botConfig.alertChannelId) {
		try {
			const channel = await readyClient.channels.fetch(botConfig.alertChannelId);
			if (channel && 'name' in channel && typeof channel.name === 'string') {
				await setMeta('bot:alert_channel_name', channel.name);
			}
		} catch {
			// The watcher will report an unreachable channel on its next tick.
		}
	}
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
	try {
		if (interaction.isChatInputCommand()) {
			await handleCommand(interaction);
		} else if (interaction.isAutocomplete()) {
			await handleAutocomplete(interaction);
		} else if (interaction.isButton()) {
			await handleButton(interaction);
		}
	} catch (error) {
		console.error(
			`[bot] Interaction ${interaction.type} failed:`,
			error instanceof Error ? error.stack ?? error.message : error
		);

		if (!interaction.isRepliable()) return;
		const content = `⚠️ ${error instanceof Error ? error.message : 'Something went wrong.'}`;
		try {
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
			} else {
				await interaction.reply({ content, flags: MessageFlags.Ephemeral });
			}
		} catch {
			// The interaction token may already be gone; nothing else to do.
		}
	}
});

client.on(Events.Error, (error) => {
	console.error('[bot] Gateway error:', error.message);
});

async function shutdown(signal: string): Promise<void> {
	if (shuttingDown) return;
	shuttingDown = true;
	console.log(`\n[bot] ${signal} received, shutting down…`);

	stopAlertWatcher();
	if (heartbeat) clearInterval(heartbeat);
	try {
		await setMeta('bot:last_seen', 0);
	} catch {
		// The database may already be closing.
	}
	try {
		await client.destroy();
	} catch {
		// Ignore teardown errors.
	}
	process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
	console.error('[bot] Unhandled rejection:', reason);
});

client.login(token).catch((error) => {
	console.error('[bot] Login failed:', error instanceof Error ? error.message : error);
	console.error('[bot] Check DISCORD_TOKEN, and that the bot has the bot + applications.commands scopes.');
	process.exit(1);
});
