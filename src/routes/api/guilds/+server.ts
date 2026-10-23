import type { RequestHandler } from './$types';
import { getGuilds } from '../../../lib/server/offers';

export const GET: RequestHandler = () => {
	return new Response(JSON.stringify({ guilds: getGuilds(40) }), {
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});
};
