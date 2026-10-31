<script lang="ts">
	import { page } from '$app/state';
	import ArticleBody from '../../../lib/components/ArticleBody.svelte';
	import { categoryClass, formatNewsDate, type NewsArticle } from '../../../lib/news';

	let { data }: { data: { article: NewsArticle; related: NewsArticle[] } } = $props();
	const article = $derived(data.article);
	const related = $derived(data.related);
	const canonicalUrl = $derived(new URL(`/news/${article.slug}`, page.url.origin).href);
	const coverUrl = $derived(
		article.coverUrl ? new URL(article.coverUrl, page.url.origin).href : null
	);
</script>

<svelte:head>
	<title>{article.title} · The Caeldun Ledger</title>
	<meta name="description" content={article.excerpt} />
	<meta property="og:title" content={article.title} />
	<meta property="og:description" content={article.excerpt} />
	<meta property="og:type" content="article" />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="article:published_time" content={article.publishedAt ?? ''} />
	<link rel="canonical" href={canonicalUrl} />
	{#if coverUrl}
		<meta property="og:image" content={coverUrl} />
	{/if}
</svelte:head>

<div class="mx-auto max-w-3xl">
	<nav class="flex items-center gap-1.5 text-[10px] font-medium text-mist-500">
		<a href="/news" class="transition hover:text-mist-200">Recent articles</a>
		<span class="text-mist-700">/</span>
		<a href="/news/paper" class="transition hover:text-mist-200">Newspaper</a>
	</nav>

	<article class="mt-6">
		<header class="border-b border-white/[0.08] pb-7 text-center">
			<div class="flex flex-wrap items-center justify-center gap-2 text-[10px] text-mist-500">
				<span class="chip {categoryClass(article.category)}">{article.category}</span>
				<span>{formatNewsDate(article.publishedAt)}</span>
				<span>·</span>
				<span class="num">{article.readingMinutes} min read</span>
			</div>
			<h1 class="mx-auto mt-4 max-w-2xl font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-mist-100 sm:text-[46px]">
				{article.title}
			</h1>
			<p class="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-mist-400">{article.excerpt}</p>
			<p class="mt-5 text-[11px] text-mist-500">
				By <span class="font-medium text-mist-300">{article.author}</span>
			</p>
		</header>

		{#if article.coverUrl}
			<figure class="mt-7">
				<img
					src={article.coverUrl}
					alt=""
					class="w-full rounded-sm border border-white/10 object-cover"
				/>
			</figure>
		{/if}

		<div class="mt-8">
			<ArticleBody html={article.bodyHtml} />
		</div>

		{#if article.tags.length}
			<div class="mt-8 flex flex-wrap gap-1.5 border-t border-white/[0.07] pt-5">
				{#each article.tags as tag (tag)}
					<span class="chip-neutral">#{tag}</span>
				{/each}
			</div>
		{/if}
	</article>

	{#if related.length}
		<section class="mt-12 border-t border-white/[0.08] pt-6">
			<h2 class="text-[10px] font-semibold uppercase tracking-[0.22em] text-mist-500">More from the ledger</h2>
			<div class="mt-4 grid gap-4 sm:grid-cols-3">
				{#each related as entry (entry.id)}
					<a href="/news/{entry.slug}" class="group border-t border-white/[0.08] pt-3">
						<span class="text-[10px] text-mist-500">{formatNewsDate(entry.publishedAt)}</span>
						<p class="mt-1 font-serif text-lg leading-snug text-mist-200 transition group-hover:text-white">
							{entry.title}
						</p>
					</a>
				{/each}
			</div>
		</section>
	{/if}
</div>
