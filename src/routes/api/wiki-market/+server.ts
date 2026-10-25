import type { RequestHandler } from './$types';
import { getWikiMarketSnapshot } from '../../../lib/server/wiki-market';

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const snapshot = await getWikiMarketSnapshot(url.searchParams.get('fresh') === '1');
		return json(snapshot);
	} catch (error) {
		console.error('[market] wiki feed failed', error);
		return json(
			{ error: error instanceof Error ? error.message : 'The live shop feed is unavailable.' },
			502
		);
	}
};
