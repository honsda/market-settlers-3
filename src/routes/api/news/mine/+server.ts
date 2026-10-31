import type { RequestHandler } from './$types';
import { hashAuthorToken, listMyNews } from '../../../../lib/server/news';
import { json, newsError, readAuthorToken } from '../../../../lib/server/news-http';

export const GET: RequestHandler = async ({ request }) => {
	try {
		const token = readAuthorToken(request);
		const articles = await listMyNews(hashAuthorToken(token));
		return json({ articles });
	} catch (error) {
		return newsError(error);
	}
};
