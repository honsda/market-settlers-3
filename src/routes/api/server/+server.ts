import type { RequestHandler } from './$types';
import { getServerStatus } from '../../../lib/server/dynmap';

export const GET: RequestHandler = async () => {
	const status = await getServerStatus();
	return new Response(JSON.stringify(status), {
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});
};
