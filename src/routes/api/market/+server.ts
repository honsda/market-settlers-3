import type { RequestHandler } from './$types';
import { getMarketResponse } from '../../../lib/server/dashboard';

export const GET: RequestHandler = async () => {
	return new Response(JSON.stringify(await getMarketResponse()), {
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});
};
