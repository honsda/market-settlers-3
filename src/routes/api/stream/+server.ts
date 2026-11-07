import type { RequestHandler } from './$types';
import { getRevision } from '../../../lib/server/db';

/**
 * Server-sent events live-sync for the dashboard. Rather than holding market
 * data in memory (which would break when the bot writes from another process),
 * we watch a revision counter in the shared database and tell the client to
 * refetch when it changes.
 */
// Workers cap subrequests per invocation. Poll every five seconds and let
// EventSource reconnect after four minutes so a free-plan Worker stays under
// 50 database calls per connection (48 polls + the initial revision read).
const POLL_MS = 5_000;
const MAX_CONNECTION_MS = 4 * 60_000;

export const GET: RequestHandler = ({ request }) => {
	const encoder = new TextEncoder();
	let timer: ReturnType<typeof setInterval> | undefined;
	let lifetime: ReturnType<typeof setTimeout> | undefined;

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let closed = false;
			let busy = false;
			let last = 0;

			const send = (event: string, data: unknown) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				} catch {
					closed = true;
				}
			};

			const close = () => {
				if (closed) return;
				closed = true;
				if (timer) clearInterval(timer);
				if (lifetime) clearTimeout(lifetime);
				try {
					controller.close();
				} catch {
					// already closed
				}
			};

			const tick = async () => {
				if (closed || busy) return;
				busy = true;
				try {
					const revision = await getRevision();
					if (revision !== last) {
						last = revision;
						send('market', { revision, ts: Date.now() });
					} else {
						send('ping', { ts: Date.now() });
					}
				} catch (error) {
					console.error('[market] revision poll failed', error);
					send('error', { message: 'Market database unavailable.' });
				} finally {
					busy = false;
				}
			};

			try {
				last = await getRevision();
			} catch (error) {
				console.error('[market] initial revision read failed', error);
				send('error', { message: 'Market database unavailable.' });
				close();
				return;
			}

			send('hello', { revision: last, ts: Date.now() });
			timer = setInterval(() => void tick(), POLL_MS);
			lifetime = setTimeout(close, MAX_CONNECTION_MS);

			request.signal.addEventListener('abort', close);
			if (request.signal.aborted) close();
		},
		cancel() {
			if (timer) clearInterval(timer);
			if (lifetime) clearTimeout(lifetime);
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream; charset=utf-8',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
};
