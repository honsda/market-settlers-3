import { db, newId, transaction } from './db';
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

function getArticleRow(id: string): NewsArticleRow | undefined {
	return db.prepare('SELECT * FROM news_articles WHERE id = ?').get(id) as unknown as
		| NewsArticleRow
		| undefined;
}

function getArticleRowBySlug(slug: string): NewsArticleRow | undefined {
	return db
		.prepare(`SELECT * FROM news_articles WHERE slug = ? AND status = 'published'`)
		.get(slug) as unknown as NewsArticleRow | undefined;
}

const MEDIA_META_COLUMNS =
	'id, article_id, author_token_hash, filename, mime, width, height, status, review_note, created_at, reviewed_at';

function mediaForArticle(id: string): NewsMediaRow[] {
	return db
		.prepare(
			`SELECT ${MEDIA_META_COLUMNS} FROM news_media WHERE article_id = ? ORDER BY created_at ASC`
		)
		.all(id) as unknown as NewsMediaRow[];
}

function getMediaRow(id: string): NewsMediaRow | undefined {
	return db.prepare('SELECT * FROM news_media WHERE id = ?').get(id) as unknown as
		| NewsMediaRow
		| undefined;
}

function getMediaMetaRow(id: string): NewsMediaRow | undefined {
	return db
		.prepare(`SELECT ${MEDIA_META_COLUMNS} FROM news_media WHERE id = ?`)
		.get(id) as unknown as NewsMediaRow | undefined;
}

function ownMedia(ids: string[], authorTokenHash: string): NewsMediaRow[] {
	if (!ids.length) return [];
	const placeholders = ids.map(() => '?').join(', ');
	const rows = db
		.prepare(
			`SELECT ${MEDIA_META_COLUMNS} FROM news_media WHERE author_token_hash = ? AND id IN (${placeholders})`
		)
		.all(authorTokenHash, ...ids) as unknown as NewsMediaRow[];
	if (rows.length !== ids.length) {
		throw new InputError('One of the images is missing or belongs to another author.');
	}
	return rows;
}

function attachMedia(articleId: string, authorTokenHash: string, ids: string[]): void {
	if (ids.length) {
		const rows = ownMedia(ids, authorTokenHash);
		if (rows.some((row) => row.article_id && row.article_id !== articleId)) {
			throw new InputError('That image is already used by another article. Upload a fresh copy.');
		}
	}
	db.prepare('UPDATE news_media SET article_id = NULL WHERE article_id = ?').run(articleId);
	if (!ids.length) return;
	const placeholders = ids.map(() => '?').join(', ');
	db.prepare(
		`UPDATE news_media SET article_id = ? WHERE author_token_hash = ? AND id IN (${placeholders})`
	).run(articleId, authorTokenHash, ...ids);
}

export function listPublishedNewsSqlite(
	limit = 12,
	cursor?: number,
	includeBody = true
): NewsPage {
	const size = Math.min(Math.max(Math.trunc(limit), 1), 30);
	const params: number[] = [];
	let where = `status = 'published' AND published_at IS NOT NULL`;
	if (cursor) {
		where += ' AND published_at < ?';
		params.push(cursor);
	}
	params.push(size);
	const rows = db
		.prepare(
			`SELECT * FROM news_articles WHERE ${where}
			 ORDER BY published_at DESC, id DESC LIMIT ?`
		)
		.all(...params) as unknown as NewsArticleRow[];
	const articles = rows.map((row) => toNewsArticle(row, [], includeBody));
	return {
		articles,
		nextCursor:
			rows.length === size && rows.length
				? Number(rows[rows.length - 1].published_at ?? 0) || null
				: null
	};
}

export function getPublishedNewsSqlite(slug: string): NewsArticle | undefined {
	const row = getArticleRowBySlug(slug);
	return row ? toNewsArticle(row, mediaForArticle(row.id)) : undefined;
}

export function getArticleForAuthorSqlite(
	id: string,
	authorTokenHash: string
): NewsArticle | undefined {
	const row = getArticleRow(id);
	if (!row || row.author_token_hash !== authorTokenHash) return undefined;
	return toNewsArticle(row, mediaForArticle(id));
}

export function listMyNewsSqlite(authorTokenHash: string): NewsArticle[] {
	const rows = db
		.prepare(
			`SELECT * FROM news_articles WHERE author_token_hash = ?
			 ORDER BY updated_at DESC LIMIT 100`
		)
		.all(authorTokenHash) as unknown as NewsArticleRow[];
	return rows.map((row) => toNewsArticle(row, mediaForArticle(row.id)));
}

export function createNewsSqlite(
	input: NewsInput,
	authorTokenHash: string,
	submit: boolean
): NewsArticle {
	const id = newId();
	const now = Date.now();
	const slug = uniqueSlug(input.title, id);
	const status = submit ? 'pending' : 'draft';
	transaction(() => {
		db.prepare(
			`INSERT INTO news_articles
				(id, slug, title, excerpt, category, author_name, author_token_hash, body_html,
				 cover_media_id, status, reading_minutes, tags, moderator_note, created_at, updated_at, published_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`
		).run(
			id,
			slug,
			input.title,
			input.excerpt,
			input.category,
			input.authorName,
			authorTokenHash,
			input.bodyHtml,
			input.coverMediaId,
			status,
			readingMinutes(input.bodyHtml),
			JSON.stringify(input.tags),
			now,
			now
		);
		attachMedia(id, authorTokenHash, mediaIdsFor(input));
	});
	const article = getArticleRow(id);
	if (!article) throw new Error('Article vanished after saving.');
	return toNewsArticle(article, mediaForArticle(id));
}

export function updateNewsSqlite(
	id: string,
	authorTokenHash: string,
	input: NewsInput,
	submit: boolean
): NewsArticle {
	const row = getArticleRow(id);
	if (!row || row.author_token_hash !== authorTokenHash) {
		throw Object.assign(new Error('Article not found.'), { status: 404 });
	}
	if (row.status === 'published') {
		throw new InputError('Published articles are locked. Create a new draft if you need to make a correction.');
	}
	if (submit) assertCompleteForReview(input);
	const now = Date.now();
	const slug = uniqueSlug(input.title, id);
	transaction(() => {
		db.prepare(
			`UPDATE news_articles SET
				slug = ?, title = ?, excerpt = ?, category = ?, author_name = ?, body_html = ?,
				cover_media_id = ?, status = ?, reading_minutes = ?, tags = ?, moderator_note = NULL,
				updated_at = ?
			 WHERE id = ?`
		).run(
			slug,
			input.title,
			input.excerpt,
			input.category,
			input.authorName,
			input.bodyHtml,
			input.coverMediaId,
			submit ? 'pending' : 'draft',
			readingMinutes(input.bodyHtml),
			JSON.stringify(input.tags),
			now,
			id
		);
		attachMedia(id, authorTokenHash, mediaIdsFor(input));
	});
	const updated = getArticleRow(id);
	if (!updated) throw new Error('Article vanished after updating.');
	return toNewsArticle(updated, mediaForArticle(id));
}

export function submitNewsSqlite(id: string, authorTokenHash: string): NewsArticle {
	const row = getArticleRow(id);
	if (!row || row.author_token_hash !== authorTokenHash) {
		throw Object.assign(new Error('Article not found.'), { status: 404 });
	}
	if (row.status === 'published') return toNewsArticle(row, mediaForArticle(id));
	if (row.status === 'pending') return toNewsArticle(row, mediaForArticle(id));
	const input: NewsInput = {
		title: row.title,
		excerpt: row.excerpt,
		category: row.category,
		authorName: row.author_name,
		bodyHtml: row.body_html,
		coverMediaId: row.cover_media_id,
		tags: []
	};
	assertCompleteForReview(input);
	db.prepare(`UPDATE news_articles SET status = 'pending', updated_at = ? WHERE id = ?`).run(
		Date.now(),
		id
	);
	const updated = getArticleRow(id);
	if (!updated) throw new Error('Article vanished after submitting.');
	return toNewsArticle(updated, mediaForArticle(id));
}

export function deleteNewsSqlite(id: string, authorTokenHash: string): void {
	const row = getArticleRow(id);
	if (!row || row.author_token_hash !== authorTokenHash) {
		throw Object.assign(new Error('Article not found.'), { status: 404 });
	}
	if (row.status === 'published' || row.status === 'pending') {
		throw new InputError('Only drafts and changes-requested articles can be deleted.');
	}
	transaction(() => {
		db.prepare('DELETE FROM news_media WHERE article_id = ?').run(id);
		db.prepare('DELETE FROM news_articles WHERE id = ?').run(id);
	});
}

export function createMediaSqlite(
	input: NewsMediaInput,
	authorTokenHash: string,
	articleId?: string | null
): NewsMedia {
	const id = newId();
	const now = Date.now();
	if (articleId) {
		const article = getArticleRow(articleId);
		if (!article || article.author_token_hash !== authorTokenHash) {
			throw Object.assign(new Error('Article not found.'), { status: 404 });
		}
	}
	db.prepare(
		`INSERT INTO news_media
			(id, article_id, author_token_hash, filename, mime, width, height, data, status, review_note, created_at, reviewed_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, NULL)`
	).run(
		id,
		articleId ?? null,
		authorTokenHash,
		input.filename,
		input.mime,
		input.width,
		input.height,
		input.data,
		now
	);
	const row = getMediaMetaRow(id);
	if (!row) throw new Error('Image vanished after saving.');
	return toNewsMedia(row);
}

export function getMediaSqlite(id: string): NewsMediaRow | undefined {
	return getMediaRow(id);
}

export function listModerationSqlite(): ModerationQueue {
	const rows = db
		.prepare(
			`SELECT * FROM news_articles WHERE status = 'pending'
			 ORDER BY updated_at ASC LIMIT 100`
		)
		.all() as unknown as NewsArticleRow[];
	const media = db
		.prepare(
			`SELECT ${MEDIA_META_COLUMNS} FROM news_media WHERE status = 'pending'
			 ORDER BY created_at ASC LIMIT 200`
		)
		.all() as unknown as NewsMediaRow[];
	return {
		articles: rows.map((row) => toNewsArticle(row, mediaForArticle(row.id))),
		media: media.map(toNewsMedia)
	};
}

export function reviewMediaSqlite(
	id: string,
	action: 'approve' | 'reject',
	note: string | null
): NewsMedia {
	const row = getMediaMetaRow(id);
	if (!row) throw Object.assign(new Error('Image not found.'), { status: 404 });
	const now = Date.now();
	db.prepare(
		`UPDATE news_media SET status = ?, review_note = ?, reviewed_at = ? WHERE id = ?`
	).run(action === 'approve' ? 'approved' : 'rejected', note, now, id);
	const updated = getMediaMetaRow(id);
	if (!updated) throw new Error('Image vanished after review.');
	return toNewsMedia(updated);
}

export function publishArticleSqlite(id: string, note: string | null): NewsArticle {
	const row = getArticleRow(id);
	if (!row) throw Object.assign(new Error('Article not found.'), { status: 404 });
	if (row.status !== 'pending') throw new InputError('Only articles in review can be published.');
	assertMediaApproved(mediaForArticle(id));
	const now = Date.now();
	db.prepare(
		`UPDATE news_articles SET status = 'published', published_at = ?, updated_at = ?, moderator_note = ?
		 WHERE id = ?`
	).run(now, now, note, id);
	const updated = getArticleRow(id);
	if (!updated) throw new Error('Article vanished after publishing.');
	return toNewsArticle(updated, mediaForArticle(id));
}

export function rejectArticleSqlite(id: string, note: string | null): NewsArticle {
	const row = getArticleRow(id);
	if (!row) throw Object.assign(new Error('Article not found.'), { status: 404 });
	if (row.status !== 'pending') throw new InputError('Only articles in review can be rejected.');
	db.prepare(
		`UPDATE news_articles SET status = 'rejected', moderator_note = ?, updated_at = ? WHERE id = ?`
	).run(note, Date.now(), id);
	const updated = getArticleRow(id);
	if (!updated) throw new Error('Article vanished after review.');
	return toNewsArticle(updated, mediaForArticle(id));
}
