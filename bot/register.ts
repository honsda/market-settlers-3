import { REST, Routes } from 'discord.js';
import { botConfig } from './config';
import { commandData } from './commands';

/**
 * Register the slash commands. Guild-scoped registration is instant and is what
 * you want while developing; global registration can take up to an hour to
 * propagate. Set DISCORD_GUILD_ID to opt into guild scope.
 */
export async function registerCommands(): Promise<string> {
	if (!botConfig.token || !botConfig.clientId) {
		throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID are required to register commands.');
	}

	const rest = new REST({ version: '10' }).setToken(botConfig.token);
	const body = commandData.map((command) => command.toJSON());

	if (botConfig.guildId) {
		await rest.put(Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId), { body });
		return `${body.length} commands in guild ${botConfig.guildId}`;
	}

	await rest.put(Routes.applicationCommands(botConfig.clientId), { body });
	return `${body.length} commands globally`;
}
