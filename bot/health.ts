import { createServer, type Server } from 'node:http';

let server: Server | null = null;

export interface BotHealth {
	ready: boolean;
	tag: string | null;
	guilds: number;
	uptime: number;
}

/**
 * The Discord gateway itself has no HTTP surface, so the bot exposes a tiny
 * read-only health endpoint for hosts that need a port to probe: Cloudflare
 * Containers, Render, Docker, or any uptime monitor used to keep a free host
 * awake. `PORT` wins because Render assigns it and routes traffic there;
 * `BOT_HEALTH_PORT` is the fallback for plain Docker and containers.
 */
export function startHealthServer(snapshot: () => BotHealth): void {
	const port = Number(process.env.PORT ?? process.env.BOT_HEALTH_PORT ?? 0);
	if (!Number.isFinite(port) || port <= 0 || server) return;

	server = createServer((request, response) => {
		const path = new URL(request.url ?? '/', 'http://localhost').pathname;
		if (path === '/health' || path === '/') {
			response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
			response.end(JSON.stringify({ ok: true, ...snapshot() }));
			return;
		}
		response.writeHead(404).end('Not found');
	});

	server.on('error', (error) => {
		console.error('[bot] Health server error:', error.message);
	});
	server.listen(port, '0.0.0.0', () => {
		console.log(`[bot] Health server listening on 0.0.0.0:${port}.`);
	});
	server.unref();
}

export function stopHealthServer(): void {
	if (!server) return;
	server.close();
	server = null;
}
