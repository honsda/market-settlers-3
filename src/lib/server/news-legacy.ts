import { NEWS, type NewsArticle as LegacyArticle, type NewsBlock } from '../news-legacy';
import type { NewsArticle } from '../news';

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function blockHtml(block: NewsBlock): string {
	switch (block.type) {
		case 'h2':
			return `<h2>${escapeHtml(block.text)}</h2>`;
		case 'h3':
			return `<h3>${escapeHtml(block.text)}</h3>`;
		case 'quote':
			return `<blockquote><p>${escapeHtml(block.text)}</p>${
				block.by ? `<p>— ${escapeHtml(block.by)}</p>` : ''
			}</blockquote>`;
		case 'list':
			return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
		case 'callout':
			return `<blockquote><p><strong>${escapeHtml(block.title)}</strong></p><p>${escapeHtml(
				block.text
			)}</p></blockquote>`;
		default:
			return `<p>${escapeHtml(block.text)}</p>`;
	}
}

function toNewsArticle(article: LegacyArticle): NewsArticle {
	return {
		id: `legacy-${article.slug}`,
		slug: article.slug,
		title: article.title,
		excerpt: article.excerpt,
		category: article.category,
		author: article.author,
		status: 'published',
		publishedAt: article.publishedAt,
		createdAt: article.publishedAt,
		updatedAt: article.publishedAt,
		readingMinutes: article.readingMinutes,
		coverUrl: null,
		bodyHtml: article.body.map(blockHtml).join('\n'),
		tags: article.tags,
		reviewNote: null,
		media: []
	};
}

/** The original hand-written dispatches are kept as an archive beside the database. */
export function legacyNewsArticles(): NewsArticle[] {
	return NEWS.map(toNewsArticle).sort(
		(a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()
	);
}
