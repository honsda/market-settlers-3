import type { RequestHandler } from './$types';
import { listAlerts } from '../../../lib/server/alerts';

export const GET: RequestHandler = ({ url }) => {
	const limit = Number(url.searchParams.get('limit') ?? 30);
	return new Response(JSON.stringify({ alerts: listAlerts(limit) }), {
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});
};
