<script lang="ts">
	import { categoryClass, formatNewsDate, type NewsArticle } from '../../lib/news';

	let { data }: { data: { articles: NewsArticle[] } } = $props();
	const articles = $derived(data.articles);
	const featured = $derived(articles[0] ?? null);
	const rest = $derived(articles.slice(1));
</script>

<svelte:head>
	<title>Recent articles · The Caeldun Ledger</title>
	<meta
		name="description"
		content="Recent dispatches, field notes and announcements from Settlers III on Caeldun."
	/>
</svelte:head>

<div class="space-y-10">
	<header class="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
		<div>
			<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-mist-500">The front page</p>
			<h2 class="mt-2 font-serif text-3xl font-semibold tracking-tight text-mist-100 sm:text-4xl">
				Recent articles
			</h2>
			<p class="mt-3 max-w-xl text-sm leading-relaxed text-mist-400">
				Dispatches from the world of Caeldun — market notes, guides, events and the occasional
				letter from the road.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<a href="/news/paper" class="btn-ghost btn-sm">Read the newspaper</a>
			<a href="/news/write" class="btn-primary btn-sm">Make an article</a>
		</div>
	</header>

	{#if featured}
		<article class="grid items-start gap-6 border-b border-white/[0.08] pb-10 md:grid-cols-[1.15fr_0.85fr]">
			<div>
				<div class="flex flex-wrap items-center gap-2 text-[10px] text-mist-500">
					<span class="chip {categoryClass(featured.category)}">{featured.category}</span>
					<span>{formatNewsDate(featured.publishedAt)}</span>
					<span>·</span>
					<span class="num">{featured.readingMinutes} min read</span>
				</div>
				<h3 class="mt-4 font-serif text-3xl font-semibold leading-[1.12] tracking-tight text-mist-100 sm:text-[40px]">
					<a href="/news/{featured.slug}" class="transition hover:text-white">{featured.title}</a>
				</h3>
				<p class="mt-4 max-w-2xl text-sm leading-relaxed text-mist-400">{featured.excerpt}</p>
				<p class="mt-5 text-[11px] text-mist-500">
					By <span class="text-mist-300">{featured.author}</span>
				</p>
			</div>
			{#if featured.coverUrl}
				<a href="/news/{featured.slug}" class="block overflow-hidden rounded-sm border border-white/10">
					<img
						src={featured.coverUrl}
						alt=""
						class="aspect-[4/3] w-full object-cover transition duration-500 hover:scale-[1.02]"
						loading="eager"
					/>
				</a>
			{:else}
				<div class="hidden border-l border-white/[0.08] pl-6 md:block">
					<p class="font-serif text-lg leading-relaxed text-mist-500">
						“The market is open, the roads are long, and the ledger keeps the rest.”
					</p>
					<p class="mt-4 text-[10px] uppercase tracking-[0.18em] text-mist-600">Caeldun Ledger</p>
				</div>
			{/if}
		</article>
	{/if}

	{#if rest.length}
		<section class="space-y-0">
			<div class="flex items-center justify-between border-b border-white/[0.08] pb-3">
				<h3 class="text-[10px] font-semibold uppercase tracking-[0.22em] text-mist-500">More dispatches</h3>
				<a href="/news/paper" class="text-[10px] font-medium text-mist-500 transition hover:text-bid">
					See the endless edition
				</a>
			</div>
			{#each rest as article (article.id)}
				<article class="grid gap-4 border-b border-white/[0.07] py-6 sm:grid-cols-[132px_minmax(0,1fr)]">
					<div class="text-[10px] leading-relaxed text-mist-500">
						<p class="num text-mist-400">{formatNewsDate(article.publishedAt)}</p>
						<p class="mt-1">{article.readingMinutes} min read</p>
					</div>
					<div>
						<div class="flex flex-wrap items-center gap-2">
							<span class="chip {categoryClass(article.category)}">{article.category}</span>
							<span class="text-[10px] text-mist-500">By {article.author}</span>
						</div>
						<h4 class="mt-2 font-serif text-xl font-semibold leading-snug text-mist-100">
							<a href="/news/{article.slug}" class="transition hover:text-white">{article.title}</a>
						</h4>
						<p class="mt-2 max-w-2xl text-[13px] leading-relaxed text-mist-400">{article.excerpt}</p>
					</div>
				</article>
			{/each}
		</section>
	{:else if !featured}
		<div class="border-y border-white/[0.08] py-16 text-center">
			<p class="font-serif text-2xl text-mist-200">The first edition is waiting.</p>
			<p class="mx-auto mt-2 max-w-md text-sm text-mist-500">
				There are no published articles yet. Write one and a moderator will review the images before
				it goes to press.
			</p>
			<a href="/news/write" class="btn-primary mt-5">Make an article</a>
		</div>
	{/if}
</div>
