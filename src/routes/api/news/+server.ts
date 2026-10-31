import type { RequestHandler } from './$types';
import { createNews, hashAuthorToken, listPublishedNews, parseNewsInput } from '../../../lib/server/news';
import { json, newsError, readAuthorToken } from '../../../lib/server/news-http';
import { rateLimit } from '../../../lib/server/rate-limit';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const limit = Number(url.searchParams.get('limit') ?? 12);
		const cursorRaw = url.searchParams.get('cursor');
		const cursor = cursorRaw && Number.isFinite(Number(cursorRaw)) ? Number(cursorRaw) : undefined;
		const full = url.searchParams.get('full') === '1';
		const page = await listPublishedNews(limit, cursor, full);
		return json(page);
	} catch (error) {
		return newsError(error);
	}
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let ip = 'unknown';
	try {
		ip = getClientAddress();
	} catch {
		// Adapters without a client address still work, just without IP limiting.
	}
	if (!rateLimit(`news:create:${ip}`, 8, 10 * 60_000)) {
		return json({ error: 'Slow down a little — too many articles in a short time.' }, 429);
	}

	try {
		const token = readAuthorToken(request);
		const body = (await request.json()) as Record<string, unknown>;
		const input = parseNewsInput(body);
		const submit = body.submit === true;
		const article = await createNews(input, hashAuthorToken(token), submit);
		return json({ article }, 201);
	} catch (error) {
		return newsError(error);
	}
};
