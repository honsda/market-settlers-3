import type { BotStatus } from '../market';
import { getMeta } from './db';
import { serverEnv } from './env';

export async function getBotStatus(): Promise<BotStatus> {
	const [lastSeenRaw, channelIdRaw, channelName, clientIdRaw, tag, guildCountRaw] =
		await Promise.all([
			getMeta('bot:last_seen'),
			getMeta('bot:alert_channel_id'),
			getMeta('bot:alert_channel_name'),
			getMeta('bot:client_id'),
			getMeta('bot:tag'),
			getMeta('bot:guild_count')
		]);

	const lastSeen = Number(lastSeenRaw ?? 0) || null;
	const channelId = channelIdRaw || serverEnv.discordAlertChannelId || null;
	const clientId = clientIdRaw || serverEnv.discordClientId;
	// The web app does not run the bot, so it should not need the bot token.
	// The bot records its application ID and heartbeat in the shared database;
	// either one is enough to know that Discord is set up.
	const configured = Boolean(clientId || lastSeen);

	return {
		configured,
		online: Boolean(lastSeen && Date.now() - lastSeen < 90_000),
		tag,
		guildCount: Number(guildCountRaw ?? 0) || null,
		lastSeen,
		alertChannelId: channelId,
		alertChannelName: channelName,
		thresholdPct: serverEnv.alertThresholdPct,
		cooldownMinutes: serverEnv.alertCooldownMinutes,
		pollSeconds: serverEnv.alertPollSeconds,
		inviteUrl: clientId
			? `https://discord.com/api/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=268528656`
			: null
	};
}
