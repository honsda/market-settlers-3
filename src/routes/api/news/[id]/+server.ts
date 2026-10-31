import type { RequestHandler } from './$types';
import {
	deleteNews,
	getArticleForAuthor,
	hashAuthorToken,
	parseNewsInput,
	updateNews
} from '../../../../lib/server/news';
import { json, newsError, readAuthorToken } from '../../../../lib/server/news-http';

export const GET: RequestHandler = async ({ params, request }) => {
	try {
		const token = readAuthorToken(request);
		const article = await getArticleForAuthor(params.id, hashAuthorToken(token));
		if (!article) return json({ error: 'Article not found.' }, 404);
		return json({ article });
	} catch (error) {
		return newsError(error);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const token = readAuthorToken(request);
		const body = (await request.json()) as Record<string, unknown>;
		const input = parseNewsInput(body);
		const submit = body.submit === true;
		const article = await updateNews(params.id, hashAuthorToken(token), input, submit);
		return json({ article });
	} catch (error) {
		return newsError(error);
	}
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	try {
		const token = readAuthorToken(request);
		await deleteNews(params.id, hashAuthorToken(token));
		return json({ ok: true });
	} catch (error) {
		return newsError(error);
	}
};
