import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPublishedNews, listPublishedNews } from '../../../lib/server/news';

export const load: PageServerLoad = async ({ params }) => {
	const article = await getPublishedNews(params.slug);
	if (!article) error(404, 'That dispatch could not be found.');
	const latest = await listPublishedNews(6, undefined, false);
	const related = latest.articles
		.filter((entry) => entry.id !== article.id)
		.sort((a, b) => Number(b.category === article.category) - Number(a.category === article.category))
		.slice(0, 3);
	return { article, related };
};
