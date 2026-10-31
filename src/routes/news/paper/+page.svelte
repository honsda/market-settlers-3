<script lang="ts">
	import { onMount } from 'svelte';
	import ArticleBody from '../../../lib/components/ArticleBody.svelte';
	import {
		categoryClass,
		groupByNewsDate,
		type NewsArticle,
		type NewsPage
	} from '../../../lib/news';

	let { data }: { data: { articles: NewsArticle[]; nextCursor: number | null } } = $props();

	// svelte-ignore state_referenced_locally
	let articles = $state<NewsArticle[]>([...data.articles]);
	// svelte-ignore state_referenced_locally
	let cursor = $state<number | null>(data.nextCursor);
	let loading = $state(false);
	let error = $state('');
	let sentinel: HTMLDivElement;

	const groups = $derived(groupByNewsDate(articles));

	async function loadMore(): Promise<void> {
		if (loading || cursor === null) return;
		loading = true;
		error = '';
		try {
			const response = await fetch(`/api/news?limit=10&full=1&cursor=${cursor}`);
			const payload = (await response.json()) as NewsPage & { error?: string };
			if (!response.ok) throw new Error(payload.error ?? 'Could not load the next page.');
			const known = new Set(articles.map((article) => article.id));
			articles = [...articles, ...payload.articles.filter((article) => !known.has(article.id))];
			cursor = payload.nextCursor;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not load the next page.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void loadMore();
			},
			{ rootMargin: '600px 0px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>The Newspaper · The Caeldun Ledger</title>
	<meta
		name="description"
		content="The endless, dated edition of The Caeldun Ledger — dispatches from Settlers III on Caeldun."
	/>
</svelte:head>

<div class="mx-auto max-w-3xl">
	<header class="border-b-2 border-mist-100/80 pb-5 text-center">
		<p class="text-[10px] font-semibold uppercase tracking-[0.3em] text-mist-500">The daily edition</p>
		<h2 class="mt-2 font-serif text-4xl font-semibold tracking-tight text-mist-100 sm:text-5xl">
			The Newspaper
		</h2>
		<p class="mx-auto mt-3 max-w-lg text-xs leading-relaxed text-mist-500">
			Every dispatch, in the order it was printed. Scroll down and keep reading.
		</p>
	</header>

	{#if articles.length}
		{#each groups as group (group.key)}
			<section>
				<div class="sticky top-0 z-10 -mx-5 border-b border-white/[0.08] bg-ink-950/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
					<h3 class="text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-mist-400">
						{group.label}
					</h3>
				</div>

				{#each group.articles as article (article.id)}
					<article class="border-b border-white/[0.08] py-9">
						<div class="flex flex-wrap items-center justify-center gap-2 text-[10px] text-mist-500">
							<span class="chip {categoryClass(article.category)}">{article.category}</span>
							<span>By {article.author}</span>
							<span>·</span>
							<span class="num">{article.readingMinutes} min read</span>
						</div>

						<h3 class="mx-auto mt-4 max-w-2xl text-center font-serif text-3xl font-semibold leading-[1.15] tracking-tight text-mist-100 sm:text-[38px]">
							<a href="/news/{article.slug}" class="transition hover:text-white">{article.title}</a>
						</h3>
						<p class="mx-auto mt-3 max-w-xl text-center text-[13px] leading-relaxed text-mist-400">
							{article.excerpt}
						</p>

						{#if article.coverUrl}
							<a href="/news/{article.slug}" class="mt-6 block overflow-hidden rounded-sm border border-white/10">
								<img
									src={article.coverUrl}
									alt=""
									class="max-h-[460px] w-full object-cover"
									loading="lazy"
								/>
							</a>
						{/if}

						<div class="mt-6">
							<ArticleBody html={article.bodyHtml} />
						</div>

						<div class="mt-6 text-center">
							<a
								href="/news/{article.slug}"
								class="text-[10px] font-semibold uppercase tracking-[0.18em] text-mist-500 transition hover:text-bid"
							>
								Read this dispatch
							</a>
						</div>
					</article>
				{/each}
			</section>
		{/each}
	{:else}
		<div class="py-20 text-center">
			<p class="font-serif text-2xl text-mist-200">No editions have been printed yet.</p>
			<a href="/news/write" class="btn-primary mt-5">Make an article</a>
		</div>
	{/if}

	<div bind:this={sentinel} class="py-10 text-center">
		{#if loading}
			<p class="text-[10px] uppercase tracking-[0.2em] text-mist-500">Loading the next page…</p>
		{:else if error}
			<button type="button" class="btn-ghost btn-sm" onclick={() => void loadMore()}>Try again</button>
			<p class="mt-2 text-[11px] text-danger">{error}</p>
		{:else if cursor === null && articles.length}
			<p class="font-serif text-sm italic text-mist-500">End of the edition.</p>
		{/if}
	</div>
</div>
