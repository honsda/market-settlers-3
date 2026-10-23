import type { RequestHandler } from './$types';
import { getRevision } from '../../../lib/server/db';

/**
 * Server-sent events live-sync for the dashboard. Rather than holding market
 * data in memory (which would break when the bot writes to SQLite from another
 * process), we watch a revision counter in the database and tell the client to
 * refetch when it changes.
 */
export const GET: RequestHandler = ({ request }) => {
	const encoder = new TextEncoder();
	let timer: ReturnType<typeof setInterval> | undefined;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let closed = false;
			let last = getRevision();

			const send = (event: string, data: unknown) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				} catch {
					closed = true;
				}
			};

			send('hello', { revision: last, ts: Date.now() });

			timer = setInterval(() => {
				if (closed) return;
				const revision = getRevision();
				if (revision !== last) {
					last = revision;
					send('market', { revision, ts: Date.now() });
				} else {
					send('ping', { ts: Date.now() });
				}
			}, 2500);

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
