import { error } from '@sveltejs/kit';
import { getArticle } from '../../../lib/news';

export function load({ params }: { params: { slug: string } }) {
	const article = getArticle(params.slug);
	if (!article) error(404, 'That dispatch could not be found.');
	return { article };
}
