const API = 'https://discord.com/api/v10';
const USER_AGENT = 'DiscordBot (https://github.com/honsda/market-settlers-3, 1.0)';

export interface DiscordChannel {
	id: string;
	name?: string;
	type: number;
}

export class DiscordApiError extends Error {
	readonly status: number;
	readonly body: string;

	constructor(status: number, body: string, path: string) {
		super(`Discord API ${path} failed with ${status}: ${body.slice(0, 500)}`);
		this.name = 'DiscordApiError';
		this.status = status;
		this.body = body;
	}
}

function botToken(): string {
	const token = process.env.DISCORD_TOKEN?.trim();
	if (!token) throw new Error('DISCORD_TOKEN is not set.');
	return token;
}

async function request<T>(
	path: string,
	init: RequestInit = {},
	options: { auth?: boolean } = {}
): Promise<T> {
	const headers = new Headers(init.headers);
	if (!headers.has('User-Agent')) headers.set('User-Agent', USER_AGENT);
	if (init.body && !headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json');
	}
	if (options.auth !== false) {
		headers.set('Authorization', `Bot ${botToken()}`);
	}

	const response = await fetch(`${API}${path}`, { ...init, headers });
	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new DiscordApiError(response.status, body, path);
	}
	if (response.status === 204) return undefined as T;
	return (await response.json()) as T;
}

export function sendChannelMessage(
	channelId: string,
	payload: unknown
): Promise<{ id: string }> {
	return request(`/channels/${channelId}/messages`, {
		method: 'POST',
		body: JSON.stringify(payload)
	});
}

export function editChannelMessage(
	channelId: string,
	messageId: string,
	payload: unknown
): Promise<{ id: string }> {
	return request(`/channels/${channelId}/messages/${messageId}`, {
		method: 'PATCH',
		body: JSON.stringify(payload)
	});
}

export function deleteChannelMessage(channelId: string, messageId: string): Promise<void> {
	return request(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' });
}

export function crosspostChannelMessage(channelId: string, messageId: string): Promise<void> {
	return request(`/channels/${channelId}/messages/${messageId}/crosspost`, { method: 'POST' });
}

export function pinChannelMessage(channelId: string, messageId: string): Promise<void> {
	return request(`/channels/${channelId}/pins/${messageId}`, { method: 'PUT' });
}

export function getChannel(channelId: string): Promise<DiscordChannel> {
	return request(`/channels/${channelId}`);
}

export function getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
	return request(`/guilds/${guildId}/channels`);
}

export function getGuild(guildId: string): Promise<{ id: string; name: string }> {
	return request(`/guilds/${guildId}`);
}

export function getCurrentUser(): Promise<{
	id: string;
	username: string;
	global_name?: string | null;
	discriminator?: string;
}> {
	return request('/users/@me');
}

export function getCurrentUserGuilds(): Promise<Array<{ id: string; name: string }>> {
	return request('/users/@me/guilds');
}

/**
 * Discord returns the application's interaction public key from its own
 * application record. The Worker can use this when DISCORD_PUBLIC_KEY is not
 * configured, so the bot token remains the only required Discord secret.
 */
export async function getApplicationPublicKey(): Promise<string> {
	const app = await request<{ verify_key?: string }>('/applications/@me');
	if (!app.verify_key) throw new Error('Discord did not return an application verify_key.');
	return app.verify_key;
}

export function addGuildMemberRole(
	guildId: string,
	userId: string,
	roleId: string
): Promise<void> {
	return request(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'PUT' });
}

export function removeGuildMemberRole(
	guildId: string,
	userId: string,
	roleId: string
): Promise<void> {
	return request(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'DELETE' });
}

/**
 * Interaction webhooks are authenticated by the interaction token, so they do
 * not need the bot token. Including it is unnecessary and can confuse proxies.
 */
export function editOriginalInteraction(
	applicationId: string,
	token: string,
	payload: unknown
): Promise<{ id: string }> {
	return request(
		`/webhooks/${applicationId}/${token}/messages/@original`,
		{ method: 'PATCH', body: JSON.stringify(payload) },
		{ auth: false }
	);
}

export function sendInteractionFollowup(
	applicationId: string,
	token: string,
	payload: unknown
): Promise<{ id: string }> {
	return request(
		`/webhooks/${applicationId}/${token}`,
		{ method: 'POST', body: JSON.stringify(payload) },
		{ auth: false }
	);
}
