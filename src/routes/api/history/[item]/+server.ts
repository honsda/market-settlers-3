import type { RequestHandler } from './$types';
import { getItemMarket } from '../../../../lib/server/dashboard';
import { getHistory } from '../../../../lib/server/market';

export const GET: RequestHandler = async ({ params, url }) => {
	const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 14), 1), 60);
	const item = await getItemMarket(params.item);
	if (!item) {
		return new Response(JSON.stringify({ error: 'No market data for that item yet.' }), {
			status: 404,
			headers: { 'content-type': 'application/json' }
		});
	}
	const history = await getHistory(params.item, days);
	return new Response(JSON.stringify({ item, history }), {
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});
};
