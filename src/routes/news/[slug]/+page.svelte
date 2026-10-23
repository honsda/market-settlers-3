<script lang="ts">
	import Icon from '../../../lib/components/Icon.svelte';
	import { toast } from '../../../lib/client/toast.svelte';
	import {
		categoryClass,
		accentClass,
		formatNewsDate,
		headingId,
		relatedArticles,
		type NewsArticle
	} from '../../../lib/news';

	let { data }: { data: { article: NewsArticle } } = $props();

	const article = $derived(data.article);
	const related = $derived(relatedArticles(article));
	const sections = $derived(
		article.body.filter((block) => block.type === 'h2').map((block) => block.text)
	);

	async function copyLink(): Promise<void> {
		try {
			await navigator.clipboard.writeText(window.location.href);
			toast('Dispatch link copied.');
		} catch {
			toast('Could not copy the link.', 'error');
		}
	}
</script>

<svelte:head>
	<title>{article.title} · Settlers Market</title>
	<meta name="description" content={article.excerpt} />
	<meta property="og:title" content={article.title} />
	<meta property="og:description" content={article.excerpt} />
	<meta property="og:type" content="article" />
	<meta property="article:published_time" content={article.publishedAt} />
</svelte:head>

<div class="space-y-5">
	<nav class="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-mist-500">
		<a href="/news" class="transition hover:text-mist-300">News</a>
		<Icon name="chevronRight" size={11} class="text-mist-700" />
		<span class={categoryClass(article.category).split(' ').slice(-1)[0]}>{article.category}</span>
		<Icon name="chevronRight" size={11} class="text-mist-700" />
		<span class="truncate text-mist-400">{article.title}</span>
	</nav>

	<div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
		<article class="panel overflow-hidden">
			<header class="relative overflow-hidden border-b border-white/[0.06] p-5 sm:p-7">
				<div
					class="pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 {accentClass(
						article.accent
					)}"
				></div>
				<div class="pointer-events-none absolute inset-0 ledger-grid opacity-20"></div>

				<div class="relative">
					<div class="flex flex-wrap items-center gap-2">
						<span class="chip {categoryClass(article.category)}">{article.category}</span>
						<span class="text-[10px] text-mist-400">{formatNewsDate(article.publishedAt)}</span>
						<span class="text-mist-700">·</span>
						<span class="num text-[10px] text-mist-500">{article.readingMinutes} min read</span>
					</div>

					<h1
						class="mt-4 max-w-2xl text-[26px] font-bold leading-[1.15] tracking-tight text-mist-100 sm:text-[34px]"
					>
						{article.title}
					</h1>
					<p class="mt-3 max-w-2xl text-sm leading-relaxed text-mist-300">{article.excerpt}</p>

					<div class="mt-6 flex flex-wrap items-center justify-between gap-3">
						<div class="flex items-center gap-2.5">
							<span
								class="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-ink-950/50 text-xs font-bold text-mist-200"
							>
								{article.author.slice(0, 1)}
							</span>
							<div class="leading-tight">
								<p class="text-[11px] font-semibold text-mist-200">{article.author}</p>
								<p class="text-[10px] text-mist-500">Caeldun correspondent</p>
							</div>
						</div>

						<button type="button" class="btn-ghost" onclick={copyLink}>
							<Icon name="copy" size={14} /> Copy link
						</button>
					</div>
				</div>
			</header>

			<div class="px-5 py-6 sm:px-7 sm:py-8">
				<div class="article-body mx-auto max-w-[68ch]">
					{#each article.body as block, index (index)}
						{#if block.type === 'p'}
							<p>{block.text}</p>
						{:else if block.type === 'h2'}
							<h2 id={headingId(block.text)} class="scroll-mt-24">{block.text}</h2>
						{:else if block.type === 'h3'}
							<h3>{block.text}</h3>
						{:else if block.type === 'quote'}
							<blockquote>
								<p>“{block.text}”</p>
								{#if block.by}<cite>— {block.by}</cite>{/if}
							</blockquote>
						{:else if block.type === 'list'}
							<ul>
								{#each block.items as item (item)}
									<li>{item}</li>
								{/each}
							</ul>
						{:else if block.type === 'callout'}
							<aside class="callout">
								<div class="flex items-start gap-2.5">
									<Icon name="info" size={15} class="mt-0.5 shrink-0 text-bid" />
									<div>
										<p class="text-xs font-semibold text-mist-100">{block.title}</p>
										<p class="mt-1 text-[11px] leading-relaxed text-mist-400">{block.text}</p>
									</div>
								</div>
							</aside>
						{/if}
					{/each}
				</div>

				<div class="mx-auto mt-8 flex max-w-[68ch] flex-wrap gap-1.5 border-t border-white/[0.06] pt-5">
					{#each article.tags as tag (tag)}
						<span class="chip-neutral">#{tag}</span>
					{/each}
				</div>
			</div>
		</article>

		<aside class="space-y-4 xl:sticky xl:top-6 xl:self-start">
			{#if sections.length}
				<section class="panel overflow-hidden">
					<div class="panel-header">
						<div class="flex items-center gap-2">
							<Icon name="layers" size={14} class="text-mist-400" />
							<h2 class="text-xs font-semibold text-mist-100">In this dispatch</h2>
						</div>
					</div>
					<nav class="p-2">
						{#each sections as section (section)}
							<a
								href="#{headingId(section)}"
								class="flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11px] leading-snug text-mist-400 transition hover:bg-white/[0.04] hover:text-mist-200"
							>
								<span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mist-600"></span>
								{section}
							</a>
						{/each}
					</nav>
				</section>
			{/if}

			<section class="panel p-4">
				<div class="flex items-center gap-2">
					<Icon name="compass" size={14} class="text-bid" />
					<h2 class="text-xs font-semibold text-mist-100">Trade on the board</h2>
				</div>
				<p class="mt-2 text-[11px] leading-relaxed text-mist-400">
					Reading is free. Posting an offer takes about thirty seconds and works without an
					account.
				</p>
				<div class="mt-3 flex flex-col gap-2">
					<a href="/market" class="btn-primary justify-center">
						<Icon name="market" size={14} /> Browse the market
					</a>
					<a href="/map" class="btn-ghost justify-center">
						<Icon name="map" size={14} /> Open the live map
					</a>
				</div>
			</section>

			{#if related.length}
				<section class="panel overflow-hidden">
					<div class="panel-header">
						<div class="flex items-center gap-2">
							<Icon name="news" size={14} class="text-mist-400" />
							<h2 class="text-xs font-semibold text-mist-100">More dispatches</h2>
						</div>
					</div>
					<div class="divide-y divide-white/[0.05]">
						{#each related as entry (entry.slug)}
							<a href="/news/{entry.slug}" class="group block px-3.5 py-3 transition hover:bg-white/[0.025]">
								<div class="flex items-center gap-1.5">
									<span class="chip {categoryClass(entry.category)}">{entry.category}</span>
									<span class="num text-[9px] text-mist-600">{entry.readingMinutes} min</span>
								</div>
								<p
									class="mt-1.5 text-[11px] font-semibold leading-snug text-mist-200 transition group-hover:text-white"
								>
									{entry.title}
								</p>
							</a>
						{/each}
					</div>
					<a
						href="/news"
						class="flex items-center justify-center gap-1.5 border-t border-white/[0.06] px-3 py-2.5 text-[10px] font-semibold text-mist-400 transition hover:text-mist-200"
					>
						All news <Icon name="arrowRight" size={12} />
					</a>
				</section>
			{/if}
		</aside>
	</div>
</div>

<style>
	.ledger-grid {
		background-image:
			linear-gradient(to right, rgba(255, 255, 255, 0.09) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(255, 255, 255, 0.09) 1px, transparent 1px);
		background-size: 22px 22px;
	}

	.article-body :global(p) {
		margin: 1.15rem 0;
		font-size: 0.875rem;
		line-height: 1.8;
		color: var(--color-mist-300);
	}

	.article-body :global(h2) {
		margin: 2.25rem 0 0.75rem;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.015em;
		color: var(--color-mist-100);
	}

	.article-body :global(h3) {
		margin: 1.75rem 0 0.5rem;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--color-mist-100);
	}

	.article-body :global(ul) {
		margin: 1rem 0;
		padding-left: 1.1rem;
		list-style: disc;
	}

	.article-body :global(li) {
		margin: 0.45rem 0;
		padding-left: 0.2rem;
		font-size: 0.875rem;
		line-height: 1.7;
		color: var(--color-mist-300);
	}

	.article-body :global(li)::marker {
		color: var(--color-bid);
	}

	.article-body :global(blockquote) {
		margin: 1.75rem 0;
		border-left: 2px solid var(--color-bid);
		padding: 0.25rem 0 0.25rem 1.1rem;
	}

	.article-body :global(blockquote p) {
		margin: 0;
		font-size: 1rem;
		font-style: italic;
		line-height: 1.65;
		color: var(--color-mist-200);
	}

	.article-body :global(blockquote cite) {
		display: block;
		margin-top: 0.6rem;
		font-size: 0.7rem;
		font-style: normal;
		color: var(--color-mist-500);
	}

	.article-body :global(.callout) {
		margin: 1.75rem 0;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.9rem;
		background: rgba(52, 211, 153, 0.04);
		padding: 0.9rem 1rem;
	}
</style>
