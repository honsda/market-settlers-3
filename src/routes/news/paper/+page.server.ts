import type { PageServerLoad } from './$types';
import { listPublishedNews } from '../../../lib/server/news';

export const load: PageServerLoad = async () => {
	return await listPublishedNews(10, undefined, true);
};
