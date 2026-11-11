import { verifyDiscordRequest } from './verify';
import {
	handleInteraction,
	type InteractionContext,
	type InteractionPayload
} from './worker-interactions';
import { runScheduled } from './worker-scheduler';
import { setMeta } from '../src/lib/server/db';
import { getApplicationPublicKey } from './discord-rest';

interface WorkerContext {
	waitUntil(promise: Promise<unknown>): void;
}

let cachedPublicKey: string | null = null;

async function resolvePublicKey(): Promise<string | null> {
	const configured = process.env.DISCORD_PUBLIC_KEY?.trim();
	if (configured) return configured;
	if (cachedPublicKey) return cachedPublicKey;
	try {
		cachedPublicKey = await getApplicationPublicKey();
		return cachedPublicKey;
	} catch (error) {
		console.error(
			'[bot] Could not read the Discord application public key:',
			error instanceof Error ? error.message : error
		);
		return null;
	}
}

/**
 * Free Cloudflare Worker entrypoint.
 *
 * Slash commands arrive as signed HTTP interactions. Scheduled work (alerts,
 * news, market feed) runs from a Cron Trigger. This intentionally replaces the
 * persistent Discord gateway; member joins, DM flows, message triggers and
 * presence are handled by the gateway bot when it runs on an always-on host.
 */
export default {
	async fetch(request: Request, _env: unknown, ctx: WorkerContext): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
			return Response.json({
				ok: true,
				service: 'anreu',
				mode: 'cloudflare-worker',
				time: new Date().toISOString()
			});
		}

		if (request.method !== 'POST' || url.pathname !== '/') {
			return new Response('Not found', { status: 404 });
		}

		const publicKey = await resolvePublicKey();
		if (!publicKey) {
			return Response.json(
				{ error: 'Discord public key is not available. Set DISCORD_PUBLIC_KEY or DISCORD_TOKEN.' },
				{ status: 500 }
			);
		}

		const signature = request.headers.get('X-Signature-Ed25519');
		const timestamp = request.headers.get('X-Signature-Timestamp');
		if (!signature || !timestamp) {
			return new Response('Missing Discord signature headers', { status: 401 });
		}

		const body = await request.text();
		if (!(await verifyDiscordRequest(body, signature, timestamp, publicKey))) {
			return new Response('Invalid request signature', { status: 401 });
		}

		let payload: InteractionPayload;
		try {
			payload = JSON.parse(body) as InteractionPayload;
		} catch {
			return new Response('Invalid JSON', { status: 400 });
		}

		if (payload.type !== 1) {
			ctx.waitUntil(setMeta('bot:worker_last_seen', Date.now()).catch(() => undefined));
		}

		try {
			const response = await handleInteraction(payload, ctx);
			return Response.json(response);
		} catch (error) {
			console.error('[bot] Unhandled interaction error:', error);
			return Response.json(
				{
					type: 4,
					data: {
						content: '⚠️ The bot hit an unexpected error. Try again in a moment.',
						flags: 64
					}
				},
				{ status: 200 }
			);
		}
	},

	async scheduled(
		_controller: unknown,
		_env: unknown,
		ctx: { waitUntil(promise: Promise<unknown>): void }
	): Promise<void> {
		ctx.waitUntil(runScheduled());
	}
};
