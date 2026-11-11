import { botConfig, requireToken } from '../bot/config';
import { registerCommands } from '../bot/register';

/**
 * Switch the Discord application from HTTP interactions (the free Cloudflare
 * Worker) to the gateway bot on Render.
 *
 * Discord routes slash commands to the Interactions Endpoint URL whenever one
 * is configured. Clearing it hands every interaction back to the gateway, and
 * the full command set (including `/apply`, `/initapply` and `/rolecitizen`)
 * becomes available again.
 *
 * Run after the Render service is live and signed in:
 *
 *   npm run bot:gateway
 */

const API = 'https://discord.com/api/v10';
const USER_AGENT = 'DiscordBot (https://github.com/honsda/market-settlers-3, 1.0)';

interface Application {
	interactions_endpoint_url?: string | null;
}

const token = requireToken();

async function discord<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	headers.set('Authorization', `Bot ${token}`);
	headers.set('User-Agent', USER_AGENT);
	if (init.body) headers.set('Content-Type', 'application/json');

	const response = await fetch(`${API}${path}`, { ...init, headers });
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(`Discord ${path} failed with ${response.status}: ${body.slice(0, 400)}`);
	}
	return (await response.json()) as T;
}

let failed = false;

try {
	const before = await discord<Application>('/applications/@me');
	console.log(
		before.interactions_endpoint_url
			? `[bot] Current interactions endpoint: ${before.interactions_endpoint_url}`
			: '[bot] No interactions endpoint is set; Discord already uses the gateway.'
	);

	// `null` removes the endpoint. Discord verifies new URLs with a PING, so it
	// cannot be set back from here without the public Worker URL.
	try {
		await discord<Application>('/applications/@me', {
			method: 'PATCH',
			body: JSON.stringify({ interactions_endpoint_url: null })
		});
		const after = await discord<Application>('/applications/@me');
		if (after.interactions_endpoint_url) {
			throw new Error(`Discord still reports ${after.interactions_endpoint_url}.`);
		}
		console.log('[bot] Interactions endpoint cleared; slash commands now go to the gateway.');
	} catch (error) {
		failed = true;
		console.error(
			'[bot] Could not clear the Interactions Endpoint URL:',
			error instanceof Error ? error.message : error
		);
		console.error(
			'[bot] Clear it by hand: Developer Portal → General Information → Interactions Endpoint URL → remove and save.'
		);
	}

	const scope = await registerCommands();
	console.log(`[bot] Registered ${scope} (full gateway command set).`);
	console.log(
		`[bot] Commands are scoped to ${botConfig.guildId ? `guild ${botConfig.guildId}` : 'global'}.`
	);
	if (!failed) {
		console.log('[bot] Start the bot on Render, then run /price in the server to verify.');
	}
} catch (error) {
	console.error(
		'[bot] Switching to the gateway failed:',
		error instanceof Error ? error.message : error
	);
	process.exitCode = 1;
}

if (failed) process.exitCode = 1;
