import type { RequestHandler } from './$types';
import { hashAuthorToken, submitNews } from '../../../../../lib/server/news';
import { json, newsError, readAuthorToken } from '../../../../../lib/server/news-http';

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const token = readAuthorToken(request);
		const article = await submitNews(params.id, hashAuthorToken(token));
		return json({ article });
	} catch (error) {
		return newsError(error);
	}
};
