import type { RequestHandler } from './$types';
import { cancelOffer, getOffer, updateOffer } from '../../../../lib/server/offers';
import { parseOfferPatch, InputError } from '../../../../lib/server/validation';

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});
}

function tokenFrom(request: Request, url: URL): string | null {
	return request.headers.get('x-edit-token') ?? url.searchParams.get('token');
}

function failure(error: unknown): Response {
	const status =
		typeof error === 'object' && error && 'status' in error ? Number((error as { status: number }).status) : 500;
	const message =
		error instanceof InputError || (status >= 400 && status < 500)
			? (error as Error).message
			: 'Something went wrong.';
	if (status >= 500) console.error('[market] offer mutation failed', error);
	return json({ error: message }, status);
}

export const GET: RequestHandler = async ({ params }) => {
	const offer = await getOffer(params.id);
	if (!offer) return json({ error: 'Offer not found.' }, 404);
	return json({ offer });
};

export const PATCH: RequestHandler = async ({ params, request, url }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Send a valid JSON body.' }, 400);
	}
	try {
		const patch = parseOfferPatch(body);
		const offer = await updateOffer(params.id, patch, tokenFrom(request, url));
		return json({ offer });
	} catch (error) {
		return failure(error);
	}
};

export const DELETE: RequestHandler = async ({ params, request, url }) => {
	try {
		const offer = await cancelOffer(params.id, tokenFrom(request, url));
		return json({ offer });
	} catch (error) {
		return failure(error);
	}
};
