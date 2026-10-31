import { timingSafeEqual } from 'node:crypto';
import { serverEnv } from './env';
import { InputError } from './validation';

export function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
}

function safeEqual(a: string, b: string): boolean {
	const left = Buffer.from(a, 'utf8');
	const right = Buffer.from(b, 'utf8');
	if (left.length !== right.length) return false;
	return timingSafeEqual(left, right);
}

export function readAuthorToken(request: Request): string {
	const token = request.headers.get('x-news-author-token')?.trim() ?? '';
	if (!/^[A-Za-z0-9_-]{24,200}$/.test(token)) {
		throw Object.assign(new Error('Missing or invalid author key. Reload the page and try again.'), {
			status: 401
		});
	}
	return token;
}

export function requireModerator(request: Request): void {
	const expected = serverEnv.newsModeratorKey;
	if (!expected) {
		throw Object.assign(
			new Error('News moderation is not configured. Set NEWS_MODERATOR_KEY in the environment.'),
			{ status: 503 }
		);
	}
	const supplied = request.headers.get('x-news-moderator-key')?.trim() ?? '';
	if (!supplied || !safeEqual(supplied, expected)) {
		throw Object.assign(new Error('That moderator key is not valid.'), { status: 403 });
	}
}

export function newsError(error: unknown): Response {
	if (error instanceof InputError) return json({ error: error.message }, 400);
	if (error instanceof SyntaxError) return json({ error: 'Invalid JSON.' }, 400);
	const status = typeof (error as { status?: unknown }).status === 'number'
		? (error as { status: number }).status
		: 500;
	if (status >= 500) console.error('[news] request failed', error);
	return json(
		{
			error:
				error instanceof Error && status < 500
					? error.message
					: 'The news desk could not complete that request.'
		},
		status
	);
}
