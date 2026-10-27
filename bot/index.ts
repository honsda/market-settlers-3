import {
	ActivityType,
	Client,
	Events,
	GatewayIntentBits,
	MessageFlags,
	Partials,
	type Guild,
	type Interaction
} from 'discord.js';
import { botConfig, requireToken } from './config';
import { handleAutocomplete, handleButton, handleCommand } from './commands';
import { addDwellerRole, handleApplicationDm, syncGuild } from './applications';
import { registerCommands } from './register';
import { startAlertWatcher, stopAlertWatcher } from './watcher';
import { startWikiMarketWatcher, stopWikiMarketWatcher } from './wiki-market';
import { getMeta, setMeta } from '../src/lib/server/db';
import { serverEnv } from '../src/lib/server/env';

const token = requireToken();

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.DirectMessages
	],
	// DM channels are not cached until the bot sends something, so Partials.Channel
	// is required to receive the first reply of an application conversation.
	partials: [Partials.Channel]
});

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
		activities: [{ name: 'Settlers III', type: ActivityType.Watching }]
	});

	startHeartbeat();
	startAlertWatcher(client);
	startWikiMarketWatcher(client);

	// Make sure the application role and review channel exist. With a pinned
	// DISCORD_GUILD_ID only that server is touched, otherwise every guild.
	const guilds: Guild[] = botConfig.guildId
		? [readyClient.guilds.cache.get(botConfig.guildId)].filter(
				(guild): guild is Guild => Boolean(guild)
			)
		: [...readyClient.guilds.cache.values()];
	for (const guild of guilds) void syncGuild(guild);

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

// New members get the light blue-grey Dweller role straight away.
client.on(Events.GuildMemberAdd, (member) => {
	void addDwellerRole(member);
});

// Application questions are answered in DMs. Messages sent to the bot in DMs
// are exempt from the Message Content intent, so no extra privilege is needed.
client.on(Events.MessageCreate, (message) => {
	if (message.author.bot || !message.channel.isDMBased()) return;
	void handleApplicationDm(message).catch((error) => {
		console.error(
			'[bot] Application DM failed:',
			error instanceof Error ? error.stack ?? error.message : error
		);
	});
});

async function shutdown(signal: string): Promise<void> {
	if (shuttingDown) return;
	shuttingDown = true;
	console.log(`\n[bot] ${signal} received, shutting down…`);

	stopAlertWatcher();
	stopWikiMarketWatcher();
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
