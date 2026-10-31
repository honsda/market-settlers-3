import { assertOk, newId, supabase } from './db';
import {
	assertCompleteForReview,
	assertMediaApproved,
	mediaIdsFor,
	readingMinutes,
	toNewsArticle,
	toNewsMedia,
	uniqueSlug,
	type ModerationQueue,
	type NewsArticleRow,
	type NewsInput,
	type NewsMediaInput,
	type NewsMediaRow
} from './news-core';
import type { NewsArticle, NewsMedia, NewsPage } from '../news';
import { InputError } from './validation';

const MEDIA_META_COLUMNS =
	'id, article_id, author_token_hash, filename, mime, width, height, status, review_note, created_at, reviewed_at';

async function getArticleRow(id: string): Promise<NewsArticleRow | undefined> {
	const { data, error } = await supabase()
		.from('news_articles')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	assertOk(error, 'read article');
	return (data ?? undefined) as NewsArticleRow | undefined;
}

async function getArticleRowBySlug(slug: string): Promise<NewsArticleRow | undefined> {
	const { data, error } = await supabase()
		.from('news_articles')
		.select('*')
		.eq('slug', slug)
		.eq('status', 'published')
		.maybeSingle();
	assertOk(error, 'read published article');
	return (data ?? undefined) as NewsArticleRow | undefined;
}

async function mediaForArticle(id: string): Promise<NewsMediaRow[]> {
	const { data, error } = await supabase()
		.from('news_media')
		.select(MEDIA_META_COLUMNS)
		.eq('article_id', id)
		.order('created_at', { ascending: true });
	assertOk(error, 'read article images');
	return (data ?? []) as NewsMediaRow[];
}

async function getMediaRow(id: string): Promise<NewsMediaRow | undefined> {
	const { data, error } = await supabase()
		.from('news_media')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	assertOk(error, 'read image');
	return (data ?? undefined) as NewsMediaRow | undefined;
}

async function getMediaMetaRow(id: string): Promise<NewsMediaRow | undefined> {
	const { data, error } = await supabase()
		.from('news_media')
		.select(MEDIA_META_COLUMNS)
		.eq('id', id)
		.maybeSingle();
	assertOk(error, 'read image');
	return (data ?? undefined) as NewsMediaRow | undefined;
}

async function ownMedia(ids: string[], authorTokenHash: string): Promise<NewsMediaRow[]> {
	if (!ids.length) return [];
	const { data, error } = await supabase()
		.from('news_media')
		.select(MEDIA_META_COLUMNS)
		.eq('author_token_hash', authorTokenHash)
		.in('id', ids);
	assertOk(error, 'check article images');
	const rows = (data ?? []) as NewsMediaRow[];
	if (rows.length !== ids.length) {
		throw new InputError('One of the images is missing or belongs to another author.');
	}
	return rows;
}

async function assertMediaReusable(
	ids: string[],
	authorTokenHash: string,
	articleId: string
): Promise<void> {
	if (!ids.length) return;
	const rows = await ownMedia(ids, authorTokenHash);
	if (rows.some((row) => row.article_id && row.article_id !== articleId)) {
		throw new InputError('That image is already used by another article. Upload a fresh copy.');
	}
}

async function attachMedia(
	articleId: string,
	authorTokenHash: string,
	ids: string[]
): Promise<void> {
	// Validate ownership before detaching the previous set, so a bad request
	// cannot leave an article with unapproved images from another author.
	await assertMediaReusable(ids, authorTokenHash, articleId);
	const { error: clearError } = await supabase()
		.from('news_media')
		.update({ article_id: null })
		.eq('article_id', articleId);
	assertOk(clearError, 'detach old article images');
	if (!ids.length) return;
	const { data, error } = await supabase()
		.from('news_media')
		.update({ article_id: articleId })
		.eq('author_token_hash', authorTokenHash)
		.in('id', ids)
		.select('id');
	assertOk(error, 'attach article images');
	if ((data ?? []).length !== ids.length) {
		throw new InputError('One of the images is missing or belongs to another author.');
	}
}

export async function listPublishedNewsSupabase(
	limit = 12,
	cursor?: number,
	includeBody = true
): Promise<NewsPage> {
	const size = Math.min(Math.max(Math.trunc(limit), 1), 30);
	let query = supabase()
		.from('news_articles')
		.select('*')
		.eq('status', 'published')
		.not('published_at', 'is', null)
		.order('published_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(size);
	if (cursor) query = query.lt('published_at', cursor);
	const { data, error } = await query;
	assertOk(error, 'list published news');
	const rows = (data ?? []) as NewsArticleRow[];
	return {
		articles: rows.map((row) => toNewsArticle(row, [], includeBody)),
		nextCursor:
			rows.length === size && rows.length
				? Number(rows[rows.length - 1].published_at ?? 0) || null
				: null
	};
}

export async function getPublishedNewsSupabase(slug: string): Promise<NewsArticle | undefined> {
	const row = await getArticleRowBySlug(slug);
	if (!row) return undefined;
	return toNewsArticle(row, await mediaForArticle(row.id));
}

export async function getArticleForAuthorSupabase(
	id: string,
	authorTokenHash: string
): Promise<NewsArticle | undefined> {
	const row = await getArticleRow(id);
	if (!row || row.author_token_hash !== authorTokenHash) return undefined;
	return toNewsArticle(row, await mediaForArticle(id));
}

export async function listMyNewsSupabase(authorTokenHash: string): Promise<NewsArticle[]> {
	const { data, error } = await supabase()
		.from('news_articles')
		.select('*')
		.eq('author_token_hash', authorTokenHash)
		.order('updated_at', { ascending: false })
		.limit(100);
	assertOk(error, 'list my articles');
	const rows = (data ?? []) as NewsArticleRow[];
	return Promise.all(rows.map(async (row) => toNewsArticle(row, await mediaForArticle(row.id))));
}

export async function createNewsSupabase(
	input: NewsInput,
	authorTokenHash: string,
	submit: boolean
): Promise<NewsArticle> {
	const id = newId();
	const now = Date.now();
	const mediaIds = mediaIdsFor(input);
	await assertMediaReusable(mediaIds, authorTokenHash, id);
	const { data, error } = await supabase()
		.from('news_articles')
		.insert({
			id,
			slug: uniqueSlug(input.title, id),
			title: input.title,
			excerpt: input.excerpt,
			category: input.category,
			author_name: input.authorName,
			author_token_hash: authorTokenHash,
			body_html: input.bodyHtml,
			cover_media_id: input.coverMediaId,
			status: submit ? 'pending' : 'draft',
			reading_minutes: readingMinutes(input.bodyHtml),
			tags: JSON.stringify(input.tags),
			moderator_note: null,
			created_at: now,
			updated_at: now,
			published_at: null
		})
		.select('*')
		.single();
	assertOk(error, 'create article');
	try {
		await attachMedia(id, authorTokenHash, mediaIds);
	} catch (attachError) {
		// Do not leave a half-created article behind if the image attach fails.
		await supabase().from('news_articles').delete().eq('id', id);
		throw attachError;
	}
	return toNewsArticle(data as NewsArticleRow, await mediaForArticle(id));
}

export async function updateNewsSupabase(
	id: string,
	authorTokenHash: string,
	input: NewsInput,
	submit: boolean
): Promise<NewsArticle> {
	const row = await getArticleRow(id);
	if (!row || row.author_token_hash !== authorTokenHash) {
		throw Object.assign(new Error('Article not found.'), { status: 404 });
	}
	if (row.status === 'published') {
		throw new InputError('Published articles are locked. Create a new draft if you need to make a correction.');
	}
	if (submit) assertCompleteForReview(input);
	const now = Date.now();
	const mediaIds = mediaIdsFor(input);
	await assertMediaReusable(mediaIds, authorTokenHash, id);
	const { data, error } = await supabase()
		.from('news_articles')
		.update({
			slug: uniqueSlug(input.title, id),
			title: input.title,
			excerpt: input.excerpt,
			category: input.category,
			author_name: input.authorName,
			body_html: input.bodyHtml,
			cover_media_id: input.coverMediaId,
			status: submit ? 'pending' : 'draft',
			reading_minutes: readingMinutes(input.bodyHtml),
			tags: JSON.stringify(input.tags),
			moderator_note: null,
			updated_at: now
		})
		.eq('id', id)
		.select('*')
		.single();
	assertOk(error, 'update article');
	await attachMedia(id, authorTokenHash, mediaIds);
	return toNewsArticle(data as NewsArticleRow, await mediaForArticle(id));
}

export async function submitNewsSupabase(
	id: string,
	authorTokenHash: string
): Promise<NewsArticle> {
	const row = await getArticleRow(id);
	if (!row || row.author_token_hash !== authorTokenHash) {
		throw Object.assign(new Error('Article not found.'), { status: 404 });
	}
	if (row.status === 'published' || row.status === 'pending') {
		return toNewsArticle(row, await mediaForArticle(id));
	}
	assertCompleteForReview({
		title: row.title,
		excerpt: row.excerpt,
		category: row.category,
		authorName: row.author_name,
		bodyHtml: row.body_html,
		coverMediaId: row.cover_media_id,
		tags: []
	});
	const { data, error } = await supabase()
		.from('news_articles')
		.update({ status: 'pending', updated_at: Date.now() })
		.eq('id', id)
		.select('*')
		.single();
	assertOk(error, 'submit article');
	return toNewsArticle(data as NewsArticleRow, await mediaForArticle(id));
}

export async function deleteNewsSupabase(id: string, authorTokenHash: string): Promise<void> {
	const row = await getArticleRow(id);
	if (!row || row.author_token_hash !== authorTokenHash) {
		throw Object.assign(new Error('Article not found.'), { status: 404 });
	}
	if (row.status === 'published' || row.status === 'pending') {
		throw new InputError('Only drafts and changes-requested articles can be deleted.');
	}
	const { error: mediaError } = await supabase().from('news_media').delete().eq('article_id', id);
	assertOk(mediaError, 'delete article images');
	const { error } = await supabase().from('news_articles').delete().eq('id', id);
	assertOk(error, 'delete article');
}

export async function createMediaSupabase(
	input: NewsMediaInput,
	authorTokenHash: string,
	articleId?: string | null
): Promise<NewsMedia> {
	const id = newId();
	if (articleId) {
		const article = await getArticleRow(articleId);
		if (!article || article.author_token_hash !== authorTokenHash) {
			throw Object.assign(new Error('Article not found.'), { status: 404 });
		}
	}
	const { data, error } = await supabase()
		.from('news_media')
		.insert({
			id,
			article_id: articleId ?? null,
			author_token_hash: authorTokenHash,
			filename: input.filename,
			mime: input.mime,
			width: input.width,
			height: input.height,
			data: input.data,
			status: 'pending',
			review_note: null,
			created_at: Date.now(),
			reviewed_at: null
		})
		.select(MEDIA_META_COLUMNS)
		.single();
	assertOk(error, 'save image');
	return toNewsMedia(data as NewsMediaRow);
}

export async function getMediaSupabase(id: string): Promise<NewsMediaRow | undefined> {
	return getMediaRow(id);
}

export async function listModerationSupabase(): Promise<ModerationQueue> {
	const { data: articleData, error: articleError } = await supabase()
		.from('news_articles')
		.select('*')
		.eq('status', 'pending')
		.order('updated_at', { ascending: true })
		.limit(100);
	assertOk(articleError, 'list moderation articles');
	const rows = (articleData ?? []) as NewsArticleRow[];
	const articles = await Promise.all(
		rows.map(async (row) => toNewsArticle(row, await mediaForArticle(row.id)))
	);

	const { data: mediaData, error: mediaError } = await supabase()
		.from('news_media')
		.select(MEDIA_META_COLUMNS)
		.eq('status', 'pending')
		.order('created_at', { ascending: true })
		.limit(200);
	assertOk(mediaError, 'list moderation images');

	return {
		articles,
		media: ((mediaData ?? []) as NewsMediaRow[]).map(toNewsMedia)
	};
}

export async function reviewMediaSupabase(
	id: string,
	action: 'approve' | 'reject',
	note: string | null
): Promise<NewsMedia> {
	const row = await getMediaMetaRow(id);
	if (!row) throw Object.assign(new Error('Image not found.'), { status: 404 });
	const { data, error } = await supabase()
		.from('news_media')
		.update({
			status: action === 'approve' ? 'approved' : 'rejected',
			review_note: note,
			reviewed_at: Date.now()
		})
		.eq('id', id)
		.select(MEDIA_META_COLUMNS)
		.single();
	assertOk(error, 'review image');
	return toNewsMedia(data as NewsMediaRow);
}

export async function publishArticleSupabase(
	id: string,
	note: string | null
): Promise<NewsArticle> {
	const row = await getArticleRow(id);
	if (!row) throw Object.assign(new Error('Article not found.'), { status: 404 });
	if (row.status !== 'pending') throw new InputError('Only articles in review can be published.');
	assertMediaApproved(await mediaForArticle(id));
	const now = Date.now();
	const { data, error } = await supabase()
		.from('news_articles')
		.update({
			status: 'published',
			published_at: now,
			updated_at: now,
			moderator_note: note
		})
		.eq('id', id)
		.select('*')
		.single();
	assertOk(error, 'publish article');
	return toNewsArticle(data as NewsArticleRow, await mediaForArticle(id));
}

export async function rejectArticleSupabase(
	id: string,
	note: string | null
): Promise<NewsArticle> {
	const row = await getArticleRow(id);
	if (!row) throw Object.assign(new Error('Article not found.'), { status: 404 });
	if (row.status !== 'pending') throw new InputError('Only articles in review can be rejected.');
	const { data, error } = await supabase()
		.from('news_articles')
		.update({ status: 'rejected', moderator_note: note, updated_at: Date.now() })
		.eq('id', id)
		.select('*')
		.single();
	assertOk(error, 'reject article');
	return toNewsArticle(data as NewsArticleRow, await mediaForArticle(id));
}
