import type { RequestHandler } from './$types';
import { getBotStatus } from '../../../../lib/server/bot-status';

export const GET: RequestHandler = async () => {
	return new Response(JSON.stringify(await getBotStatus()), {
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});
};
