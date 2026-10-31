import type { RequestHandler } from './$types';
import {
	createNewsMedia,
	hashAuthorToken,
	parseMediaInput
} from '../../../../lib/server/news';
import { json, newsError, readAuthorToken } from '../../../../lib/server/news-http';
import { rateLimit } from '../../../../lib/server/rate-limit';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let ip = 'unknown';
	try {
		ip = getClientAddress();
	} catch {
		// Adapters without a client address still work, just without IP limiting.
	}
	if (!rateLimit(`news:media:${ip}`, 24, 10 * 60_000)) {
		return json({ error: 'Too many image uploads. Wait a few minutes and try again.' }, 429);
	}

	try {
		const token = readAuthorToken(request);
		const form = await request.formData();
		const file = form.get('image');
		if (!(file instanceof File)) {
			return json({ error: 'Choose an image to upload.' }, 400);
		}
		const meta = parseMediaInput(file);
		const articleIdRaw = form.get('articleId');
		const articleId =
			typeof articleIdRaw === 'string' && articleIdRaw.trim() ? articleIdRaw.trim() : null;
		const buffer = Buffer.from(await file.arrayBuffer());
		if (buffer.length > 4 * 1024 * 1024) {
			return json({ error: 'Images must be 4 MB or smaller.' }, 400);
		}
		const media = await createNewsMedia(
			{
				...meta,
				data: buffer.toString('base64')
			},
			hashAuthorToken(token),
			articleId
		);
		return json({ media }, 201);
	} catch (error) {
		return newsError(error);
	}
};
