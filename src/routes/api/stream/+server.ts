import type { RequestHandler } from './$types';
import { getRevision } from '../../../lib/server/db';

/**
 * Server-sent events live-sync for the dashboard. Rather than holding market
 * data in memory (which would break when the bot writes from another process),
 * we watch a revision counter in the shared database and tell the client to
 * refetch when it changes.
 */
export const GET: RequestHandler = ({ request }) => {
	const encoder = new TextEncoder();
	let timer: ReturnType<typeof setInterval> | undefined;

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
			timer = setInterval(() => void tick(), 2500);

			request.signal.addEventListener('abort', close);
			if (request.signal.aborted) close();
		},
		cancel() {
			if (timer) clearInterval(timer);
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
