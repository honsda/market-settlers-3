import type { RequestHandler } from './$types';
import { getBotStatus } from '../../../../lib/server/bot-status';

export const GET: RequestHandler = () => {
	return new Response(JSON.stringify(getBotStatus()), {
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});
};
