import type { RequestHandler } from './$types';
import { listOffers, createOffer } from '../../../lib/server/offers';
import { parseOfferInput, InputError } from '../../../lib/server/validation';
import { rateLimit } from '../../../lib/server/rate-limit';
import type { OfferStatus, Side } from '../../../lib/market';

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});
}

export const GET: RequestHandler = async ({ url }) => {
	const status = (url.searchParams.get('status') ?? 'open') as OfferStatus | 'all';
	const side = (url.searchParams.get('side') ?? undefined) as Side | undefined;
	const offers = await listOffers({
		status: status === 'all' ? 'all' : status,
		side: side === 'buy' || side === 'sell' ? side : undefined,
		itemId: url.searchParams.get('item') ?? undefined,
		ign: url.searchParams.get('ign') ?? undefined,
		guild: url.searchParams.get('guild') ?? undefined,
		limit: Number(url.searchParams.get('limit') ?? 200)
	});
	return json({ offers });
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let ip = 'unknown';
	try {
		ip = getClientAddress();
	} catch {
		// Adapters without client address support still work, just without limiting.
	}

	if (!rateLimit(`offer:${ip}`, 12, 5 * 60_000)) {
		return json({ error: 'Slow down a little — too many offers in a short time.' }, 429);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Send a valid JSON body.' }, 400);
	}

	try {
		const input = parseOfferInput(body);
		const { offer, editToken } = await createOffer(input);
		return json({ offer, editToken }, 201);
	} catch (error) {
		if (error instanceof InputError) return json({ error: error.message }, 400);
		console.error('[market] failed to create offer', error);
		return json({ error: 'The offer could not be saved. Try again.' }, 500);
	}
};
