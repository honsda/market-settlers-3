export const NEWS_CATEGORIES = ['Announcement', 'Market', 'Guide', 'Event'] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];
export type NewsStatus = 'draft' | 'pending' | 'published' | 'rejected';
export type NewsMediaStatus = 'pending' | 'approved' | 'rejected';

export interface NewsMedia {
	id: string;
	filename: string;
	mime: string;
	status: NewsMediaStatus;
	articleId: string | null;
	createdAt: string;
	reviewedAt: string | null;
	reviewNote: string | null;
	url: string;
}

export interface NewsArticle {
	id: string;
	slug: string;
	title: string;
	excerpt: string;
	category: NewsCategory;
	author: string;
	status: NewsStatus;
	publishedAt: string | null;
	createdAt: string;
	updatedAt: string;
	readingMinutes: number;
	coverUrl: string | null;
	bodyHtml: string;
	tags: string[];
	reviewNote: string | null;
	media: NewsMedia[];
}

export interface NewsPage {
	articles: NewsArticle[];
	nextCursor: number | null;
}

export function isNewsCategory(value: unknown): value is NewsCategory {
	return typeof value === 'string' && (NEWS_CATEGORIES as readonly string[]).includes(value);
}

export function formatNewsDate(value: string | number | null): string {
	if (!value) return 'Unpublished';
	return new Date(value).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

export function formatNewsDateLong(value: string | number | null): string {
	if (!value) return 'Unpublished';
	return new Date(value).toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

export function newsDateKey(value: string | number | null): string {
	if (!value) return 'unpublished';
	const date = new Date(value);
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
		date.getUTCDate()
	).padStart(2, '0')}`;
}

export function categoryClass(category: NewsCategory): string {
	switch (category) {
		case 'Announcement':
			return 'border-bid/25 bg-bid/10 text-bid';
		case 'Market':
			return 'border-ask/25 bg-ask/10 text-ask';
		case 'Guide':
			return 'border-sky-400/25 bg-sky-400/10 text-sky-300';
		default:
			return 'border-violet-400/25 bg-violet-400/10 text-violet-300';
	}
}

export function statusLabel(status: NewsStatus): string {
	switch (status) {
		case 'draft':
			return 'Draft';
		case 'pending':
			return 'In review';
		case 'published':
			return 'Published';
		default:
			return 'Changes requested';
	}
}

export function statusClass(status: NewsStatus): string {
	switch (status) {
		case 'draft':
			return 'border-white/10 bg-white/[0.04] text-mist-300';
		case 'pending':
			return 'border-ask/25 bg-ask/10 text-ask';
		case 'published':
			return 'border-bid/25 bg-bid/10 text-bid';
		default:
			return 'border-danger/25 bg-danger/10 text-danger';
	}
}

export function readingMinutesFromText(text: string): number {
	const words = text.trim().split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.ceil(words / 220));
}

export function stripHtml(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

export function extractMediaIds(html: string): string[] {
	const ids = new Set<string>();
	for (const match of html.matchAll(/\/api\/news\/media\/([A-Za-z0-9_-]+)/g)) {
		ids.add(match[1]);
	}
	return [...ids];
}

export function groupByNewsDate(articles: NewsArticle[]): { key: string; label: string; articles: NewsArticle[] }[] {
	const groups = new Map<string, { key: string; label: string; articles: NewsArticle[] }>();
	for (const article of articles) {
		const key = newsDateKey(article.publishedAt);
		const current = groups.get(key);
		if (current) {
			current.articles.push(article);
		} else {
			groups.set(key, {
				key,
				label: formatNewsDateLong(article.publishedAt),
				articles: [article]
			});
		}
	}
	return [...groups.values()];
}
