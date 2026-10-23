import type { BotStatus } from '../market';
import { getMeta } from './db';
import { serverEnv } from './env';

export function getBotStatus(): BotStatus {
	const lastSeen = Number(getMeta('bot:last_seen') ?? 0) || null;
	const configured = Boolean(serverEnv.discordToken && serverEnv.discordClientId);
	const channelId = getMeta('bot:alert_channel_id') || serverEnv.discordAlertChannelId || null;
	const channelName = getMeta('bot:alert_channel_name');
	const clientId = getMeta('bot:client_id') || serverEnv.discordClientId;

	return {
		configured,
		online: Boolean(lastSeen && Date.now() - lastSeen < 90_000),
		tag: getMeta('bot:tag'),
		guildCount: Number(getMeta('bot:guild_count') ?? 0) || null,
		lastSeen,
		alertChannelId: channelId,
		alertChannelName: channelName,
		thresholdPct: serverEnv.alertThresholdPct,
		cooldownMinutes: serverEnv.alertCooldownMinutes,
		pollSeconds: serverEnv.alertPollSeconds,
		inviteUrl: clientId
			? `https://discord.com/api/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=19456`
			: null
	};
}
