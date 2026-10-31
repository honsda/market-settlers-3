import type { RequestHandler } from './$types';
import { getNewsMedia } from '../../../../../lib/server/news';

export const GET: RequestHandler = async ({ params }) => {
	const media = await getNewsMedia(params.id);
	if (!media) return new Response('Image not found.', { status: 404 });
	const approved = media.status === 'approved';
	return new Response(Buffer.from(media.data, 'base64'), {
		headers: {
			'content-type': media.mime,
			'content-length': String(Buffer.byteLength(media.data, 'base64')),
			'cache-control': approved ? 'public, max-age=31536000, immutable' : 'no-store',
			'x-robots-tag': approved ? 'index, follow' : 'noindex, nofollow',
			'content-disposition': `inline; filename="${media.filename.replace(/[^\w.-]+/g, '-')}"`,
			'x-content-type-options': 'nosniff'
		}
	});
};
