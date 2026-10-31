import type { NewsArticle, NewsMedia, NewsPage } from '../news';
import { usingSupabase } from './db';
import { legacyNewsArticles } from './news-legacy';
import type { ModerationQueue, NewsInput, NewsMediaInput, NewsMediaRow } from './news-core';
import * as sqlite from './news-sqlite';
import * as supabaseBackend from './news-supabase';

export type { ModerationQueue, NewsInput, NewsMediaInput, NewsMediaRow } from './news-core';
export {
	hashAuthorToken,
	parseMediaInput,
	parseNewsInput,
	toNewsArticle,
	toNewsMedia
} from './news-core';

export async function listPublishedNews(
	limit = 12,
	cursor?: number,
	includeBody = true
): Promise<NewsPage> {
	const page = usingSupabase
		? await supabaseBackend.listPublishedNewsSupabase(limit, cursor, includeBody)
		: sqlite.listPublishedNewsSqlite(limit, cursor, includeBody);

	// The original static dispatches stay visible on the first page, even on a
	// fresh database. Database rows always win if a slug is reused.
	if (cursor) return page;
	const known = new Set(page.articles.map((article) => article.slug));
	const archive = legacyNewsArticles()
		.filter((article) => !known.has(article.slug))
		.map((article) => (includeBody ? article : { ...article, bodyHtml: '' }));
	if (!archive.length) return page;
	const articles = [...page.articles, ...archive].sort(
		(a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()
	);
	return { ...page, articles };
}

export async function getPublishedNews(slug: string): Promise<NewsArticle | undefined> {
	const article = usingSupabase
		? await supabaseBackend.getPublishedNewsSupabase(slug)
		: sqlite.getPublishedNewsSqlite(slug);
	return article ?? legacyNewsArticles().find((entry) => entry.slug === slug);
}

export async function getArticleForAuthor(
	id: string,
	authorTokenHash: string
): Promise<NewsArticle | undefined> {
	return usingSupabase
		? supabaseBackend.getArticleForAuthorSupabase(id, authorTokenHash)
		: sqlite.getArticleForAuthorSqlite(id, authorTokenHash);
}

export async function listMyNews(authorTokenHash: string): Promise<NewsArticle[]> {
	return usingSupabase
		? supabaseBackend.listMyNewsSupabase(authorTokenHash)
		: sqlite.listMyNewsSqlite(authorTokenHash);
}

export async function createNews(
	input: NewsInput,
	authorTokenHash: string,
	submit: boolean
): Promise<NewsArticle> {
	return usingSupabase
		? supabaseBackend.createNewsSupabase(input, authorTokenHash, submit)
		: sqlite.createNewsSqlite(input, authorTokenHash, submit);
}

export async function updateNews(
	id: string,
	authorTokenHash: string,
	input: NewsInput,
	submit: boolean
): Promise<NewsArticle> {
	return usingSupabase
		? supabaseBackend.updateNewsSupabase(id, authorTokenHash, input, submit)
		: sqlite.updateNewsSqlite(id, authorTokenHash, input, submit);
}

export async function submitNews(id: string, authorTokenHash: string): Promise<NewsArticle> {
	return usingSupabase
		? supabaseBackend.submitNewsSupabase(id, authorTokenHash)
		: sqlite.submitNewsSqlite(id, authorTokenHash);
}

export async function deleteNews(id: string, authorTokenHash: string): Promise<void> {
	return usingSupabase
		? supabaseBackend.deleteNewsSupabase(id, authorTokenHash)
		: sqlite.deleteNewsSqlite(id, authorTokenHash);
}

export async function createNewsMedia(
	input: NewsMediaInput,
	authorTokenHash: string,
	articleId?: string | null
): Promise<NewsMedia> {
	return usingSupabase
		? supabaseBackend.createMediaSupabase(input, authorTokenHash, articleId)
		: sqlite.createMediaSqlite(input, authorTokenHash, articleId);
}

export async function getNewsMedia(id: string): Promise<NewsMediaRow | undefined> {
	return usingSupabase ? supabaseBackend.getMediaSupabase(id) : sqlite.getMediaSqlite(id);
}

export async function moderationQueue(): Promise<ModerationQueue> {
	return usingSupabase
		? supabaseBackend.listModerationSupabase()
		: sqlite.listModerationSqlite();
}

export async function reviewNewsMedia(
	id: string,
	action: 'approve' | 'reject',
	note: string | null
): Promise<NewsMedia> {
	return usingSupabase
		? supabaseBackend.reviewMediaSupabase(id, action, note)
		: sqlite.reviewMediaSqlite(id, action, note);
}

export async function publishNewsArticle(id: string, note: string | null): Promise<NewsArticle> {
	return usingSupabase
		? supabaseBackend.publishArticleSupabase(id, note)
		: sqlite.publishArticleSqlite(id, note);
}

export async function rejectNewsArticle(id: string, note: string | null): Promise<NewsArticle> {
	return usingSupabase
		? supabaseBackend.rejectArticleSupabase(id, note)
		: sqlite.rejectArticleSqlite(id, note);
}
