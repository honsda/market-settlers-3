import { serverEnv } from '../src/lib/server/env';

export const botConfig = {
	token: serverEnv.discordToken,
	clientId: serverEnv.discordClientId,
	guildId: serverEnv.discordGuildId,
	alertChannelId: serverEnv.discordAlertChannelId,
	thresholdPct: serverEnv.alertThresholdPct,
	pollSeconds: serverEnv.alertPollSeconds,
	appUrl: serverEnv.appUrl
};

export function requireToken(): string {
	if (!botConfig.token) {
		console.error(
			[
				'',
				'  DISCORD_TOKEN is not set.',
				'',
				'  1. Copy .env.example to .env',
				'  2. Create a bot at https://discord.com/developers/applications',
				'  3. Put its token and application id in .env',
				'  4. Run: npm run bot',
				''
			].join('\n')
		);
		process.exit(1);
	}
	return botConfig.token;
}
