import type { RequestHandler } from './$types';
import { getItemMarket } from '../../../../lib/server/dashboard';
import { getHistory } from '../../../../lib/server/market';

export const GET: RequestHandler = ({ params, url }) => {
	const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 14), 1), 60);
	const item = getItemMarket(params.item);
	if (!item) {
		return new Response(JSON.stringify({ error: 'No market data for that item yet.' }), {
			status: 404,
			headers: { 'content-type': 'application/json' }
		});
	}
	return new Response(JSON.stringify({ item, history: getHistory(params.item, days) }), {
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});
};
