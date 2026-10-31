import type { RequestHandler } from './$types';
import {
	moderationQueue,
	publishNewsArticle,
	rejectNewsArticle,
	reviewNewsMedia
} from '../../../../lib/server/news';
import { json, newsError, requireModerator } from '../../../../lib/server/news-http';

export const GET: RequestHandler = async ({ request }) => {
	try {
		requireModerator(request);
		return json(await moderationQueue());
	} catch (error) {
		return newsError(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		requireModerator(request);
		const body = (await request.json()) as Record<string, unknown>;
		const kind = body.kind;
		const id = typeof body.id === 'string' ? body.id.trim() : '';
		const action = body.action;
		const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null;
		if (!id || (action !== 'approve' && action !== 'reject')) {
			return json({ error: 'Choose an item and an approve/reject action.' }, 400);
		}
		if (kind === 'media') {
			const media = await reviewNewsMedia(id, action, note);
			return json({ media });
		}
		if (kind === 'article') {
			const article =
				action === 'approve'
					? await publishNewsArticle(id, note)
					: await rejectNewsArticle(id, note);
			return json({ article });
		}
		return json({ error: 'Unknown moderation target.' }, 400);
	} catch (error) {
		return newsError(error);
	}
};
