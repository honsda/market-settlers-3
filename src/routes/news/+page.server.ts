import type { PageServerLoad } from './$types';
import { listPublishedNews } from '../../lib/server/news';

export const load: PageServerLoad = async () => {
	const page = await listPublishedNews(12, undefined, false);
	return { articles: page.articles };
};
