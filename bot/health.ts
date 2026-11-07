import { createServer, type Server } from 'node:http';

let server: Server | null = null;

export interface BotHealth {
	ready: boolean;
	tag: string | null;
	guilds: number;
	uptime: number;
}

/**
 * Cloudflare Containers need a port to probe before they route traffic to the
 * image. The Discord gateway itself has no HTTP surface, so the bot exposes a
 * tiny read-only health endpoint when BOT_HEALTH_PORT is set.
 */
export function startHealthServer(snapshot: () => BotHealth): void {
	const port = Number(process.env.BOT_HEALTH_PORT ?? 0);
	if (!port || server) return;

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
