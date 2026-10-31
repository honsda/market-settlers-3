import { createHash } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import {
	NEWS_CATEGORIES,
	extractMediaIds,
	readingMinutesFromText,
	stripHtml,
	type NewsArticle,
	type NewsCategory,
	type NewsMedia,
	type NewsMediaStatus,
	type NewsStatus
} from '../news';
import { InputError } from './validation';

export interface NewsArticleRow {
	id: string;
	slug: string;
	title: string;
	excerpt: string;
	category: NewsCategory;
	author_name: string;
	author_token_hash: string;
	body_html: string;
	cover_media_id: string | null;
	status: NewsStatus;
	reading_minutes: number;
	tags: string;
	moderator_note: string | null;
	created_at: number;
	updated_at: number;
	published_at: number | null;
}

export interface NewsMediaRow {
	id: string;
	article_id: string | null;
	author_token_hash: string;
	filename: string;
	mime: string;
	width: number | null;
	height: number | null;
	data: string;
	status: NewsMediaStatus;
	review_note: string | null;
	created_at: number;
	reviewed_at: number | null;
}

export interface NewsInput {
	title: string;
	excerpt: string;
	category: NewsCategory;
	authorName: string;
	bodyHtml: string;
	coverMediaId: string | null;
	tags: string[];
}

export interface NewsMediaInput {
	filename: string;
	mime: string;
	width: number | null;
	height: number | null;
	data: string;
}

export interface ModerationQueue {
	articles: NewsArticle[];
	media: NewsMedia[];
}

const MAX_BODY_CHARS = 160_000;
// Keep uploads under Vercel's 4.5 MB serverless request-body limit once the
// multipart envelope is included.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function hashAuthorToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function slugify(value: string): string {
	const slug = value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
	return slug || 'dispatch';
}

export function uniqueSlug(title: string, id: string): string {
	return `${slugify(title)}-${id.slice(0, 6)}`;
}

export function sanitizeArticleHtml(value: unknown): string {
	if (typeof value !== 'string') throw new InputError('Article content is missing.');
	if (value.length > MAX_BODY_CHARS) throw new InputError('That article is too long.');
	const clean = sanitizeHtml(value, {
		allowedTags: [
			'p',
			'br',
			'h2',
			'h3',
			'strong',
			'b',
			'em',
			'i',
			'u',
			's',
			'blockquote',
			'ul',
			'ol',
			'li',
			'a',
			'img',
			'code',
			'pre',
			'hr'
		],
		allowedAttributes: {
			a: ['href', 'title', 'target', 'rel'],
			img: ['src', 'alt', 'title'],
			code: ['class']
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		allowedSchemesByTag: {
			a: ['http', 'https', 'mailto'],
			img: ['http', 'https']
		},
		transformTags: {
			a: (tagName, attribs) => ({
				tagName,
				attribs: {
					...attribs,
					target: '_blank',
					rel: 'noopener noreferrer nofollow'
				}
			}),
			img: (tagName, attribs) => {
				const src = String(attribs.src ?? '');
				if (!/^\/api\/news\/media\/[A-Za-z0-9_-]+$/.test(src)) {
					return { tagName: 'span', attribs: {} as Record<string, string> };
				}
				return {
					tagName,
					attribs: {
						src,
						alt: String(attribs.alt ?? ''),
						title: String(attribs.title ?? '')
					}
				};
			}
		}
	});
	if (!stripHtml(clean)) throw new InputError('Write something before saving the article.');
	return clean;
}

function text(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function tagList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const tags = value
		.filter((entry): entry is string => typeof entry === 'string')
		.map((entry) => entry.replace(/^#/, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, ''))
		.filter(Boolean)
		.map((entry) => entry.slice(0, 24));
	return [...new Set(tags)].slice(0, 6);
}

export function parseNewsInput(body: unknown): NewsInput {
	if (!body || typeof body !== 'object') throw new InputError('Expected a JSON object.');
	const data = body as Record<string, unknown>;

	const title = text(data.title, 120);
	if (title.length < 3) throw new InputError('Give the article a title.');
	const excerpt = text(data.excerpt, 320);
	if (excerpt.length < 10) throw new InputError('Add a short summary for the article list.');
	const category = data.category;
	if (typeof category !== 'string' || !NEWS_CATEGORIES.includes(category as NewsCategory)) {
		throw new InputError('Choose a valid category.');
	}
	const authorName = text(data.authorName, 40);
	if (authorName.length < 2) throw new InputError('Add the name readers should see.');

	const bodyHtml = sanitizeArticleHtml(data.bodyHtml);

	let coverMediaId: string | null = null;
	if (typeof data.coverMediaId === 'string' && data.coverMediaId.trim()) {
		coverMediaId = data.coverMediaId.trim();
		if (!/^[A-Za-z0-9_-]{6,80}$/.test(coverMediaId)) {
			throw new InputError('That cover image is not valid.');
		}
	}

	return {
		title,
		excerpt,
		category: category as NewsCategory,
		authorName,
		bodyHtml,
		coverMediaId,
		tags: tagList(data.tags)
	};
}

export function parseMediaInput(file: File): NewsMediaInput {
	const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
	if (!allowed.has(file.type)) {
		throw new InputError('Use a JPEG, PNG, WebP, GIF or AVIF image.');
	}
	if (file.size > MAX_IMAGE_BYTES) {
		throw new InputError('Images must be 4 MB or smaller. Try a smaller image.');
	}
	return {
		filename: text(file.name, 120) || 'image',
		mime: file.type,
		width: null,
		height: null,
		data: ''
	};
}

export function mediaIdsFor(input: NewsInput): string[] {
	const ids = extractMediaIds(input.bodyHtml);
	if (input.coverMediaId) ids.push(input.coverMediaId);
	return [...new Set(ids)];
}

export function readingMinutes(html: string): number {
	return readingMinutesFromText(stripHtml(html));
}

export function toNewsArticle(row: NewsArticleRow, media: NewsMediaRow[] = [], includeBody = true): NewsArticle {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		excerpt: row.excerpt,
		category: row.category,
		author: row.author_name,
		status: row.status,
		publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
		createdAt: new Date(row.created_at).toISOString(),
		updatedAt: new Date(row.updated_at).toISOString(),
		readingMinutes: row.reading_minutes,
		coverUrl: row.cover_media_id ? `/api/news/media/${row.cover_media_id}` : null,
		bodyHtml: includeBody ? row.body_html : '',
		tags: parseTags(row.tags),
		reviewNote: row.moderator_note,
		media: media.map(toNewsMedia)
	};
}

export function toNewsMedia(row: NewsMediaRow): NewsMedia {
	return {
		id: row.id,
		filename: row.filename,
		mime: row.mime,
		status: row.status,
		articleId: row.article_id,
		createdAt: new Date(row.created_at).toISOString(),
		reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
		reviewNote: row.review_note,
		url: `/api/news/media/${row.id}`
	};
}

function parseTags(raw: string): string[] {
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
	} catch {
		return [];
	}
}

export function assertCompleteForReview(input: NewsInput): void {
	if (!input.title || !input.excerpt || !input.bodyHtml) {
		throw new InputError('Add a title, summary and body before submitting for review.');
	}
}

export function assertMediaOwned(ids: string[], media: NewsMediaRow[]): void {
	const owned = new Set(media.map((row) => row.id));
	const missing = ids.filter((id) => !owned.has(id));
	if (missing.length) {
		throw new InputError('One of the images is missing or belongs to another author.');
	}
}

export function assertMediaApproved(media: NewsMediaRow[]): void {
	const blocked = media.filter((row) => row.status !== 'approved');
	if (blocked.length) {
		throw new InputError('Every image must be approved by a moderator before the article can be published.');
	}
}

export function safeSlugBase(value: string): string {
	return slugify(value);
}
