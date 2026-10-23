<script lang="ts">
	import Icon from '../../lib/components/Icon.svelte';
	import {
		NEWS,
		categoryClass,
		accentClass,
		featuredArticle,
		formatNewsDate,
		otherArticles,
		type NewsCategory
	} from '../../lib/news';

	const featured = featuredArticle();
	const rest = otherArticles();
	const categories: ('All' | NewsCategory)[] = ['All', 'Announcement', 'Market', 'Guide', 'Event'];
	let category = $state<'All' | NewsCategory>('All');

	const visible = $derived(
		rest.filter((article) => category === 'All' || article.category === category)
	);

	function countFor(value: 'All' | NewsCategory): number {
		return value === 'All' ? rest.length : rest.filter((article) => article.category === value).length;
	}
</script>

<svelte:head>
	<title>News & dispatches · Settlers Market</title>
	<meta
		name="description"
		content="Market news, trading guides and community dispatches from Settlers III on Caeldun."
	/>
</svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="eyebrow flex items-center gap-2">
				<Icon name="news" size={12} />
				The Caeldun Ledger
			</p>
			<h1 class="mt-1.5 text-2xl font-bold tracking-tight text-mist-100 sm:text-[30px]">
				News & dispatches
			</h1>
			<p class="mt-1 max-w-xl text-sm text-mist-400">
				Market notes, practical trading guides and the occasional field report from around the
				world.
			</p>
		</div>
		<a href="/discord" class="btn-ghost">
			<Icon name="discord" size={15} /> Market alerts
		</a>
	</header>

	<a
		href="/news/{featured.slug}"
		class="panel group relative grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_340px]"
	>
		<div class="relative z-10 p-5 sm:p-7">
			<div class="flex flex-wrap items-center gap-2">
				<span class="chip {categoryClass(featured.category)}">{featured.category}</span>
				<span class="text-[10px] font-medium text-mist-500">
					{formatNewsDate(featured.publishedAt)}
				</span>
				<span class="text-mist-700">·</span>
				<span class="num text-[10px] text-mist-500">{featured.readingMinutes} min read</span>
			</div>

			<h2
				class="mt-4 max-w-xl text-2xl font-bold leading-tight tracking-tight text-mist-100 transition group-hover:text-white sm:text-[32px]"
			>
				{featured.title}
			</h2>
			<p class="mt-3 max-w-xl text-sm leading-relaxed text-mist-400">{featured.excerpt}</p>

			<div class="mt-6 flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-2.5">
					<span
						class="flex h-8 w-8 items-center justify-center rounded-full border border-bid/25 bg-bid/10 text-[11px] font-bold text-bid"
					>
						{featured.author.slice(0, 1)}
					</span>
					<div class="leading-tight">
						<p class="text-[11px] font-semibold text-mist-200">{featured.author}</p>
						<p class="text-[10px] text-mist-500">Featured dispatch</p>
					</div>
				</div>
				<span class="flex items-center gap-1.5 text-xs font-semibold text-bid">
					Read the dispatch
					<Icon
						name="arrowRight"
						size={14}
						class="transition group-hover:translate-x-0.5"
					/>
				</span>
			</div>
		</div>

		<div
			class="relative hidden min-h-[280px] items-center justify-center border-l border-white/[0.06] bg-gradient-to-br lg:flex {accentClass(
				featured.accent
			)}"
		>
			<div class="absolute inset-0 ledger-grid opacity-[0.35]"></div>
			<div class="relative flex flex-col items-center gap-4 p-6 text-center">
				<span class="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-ink-950/60 shadow-2xl backdrop-blur">
					<Icon name={featured.icon} size={34} />
				</span>
				<div>
					<p class="num text-[10px] font-semibold uppercase tracking-[0.22em] text-mist-500">
						Issue 01
					</p>
					<p class="mt-1 text-sm font-semibold text-mist-200">The market is open</p>
				</div>
				<div class="flex flex-wrap justify-center gap-1.5">
					{#each featured.tags as tag (tag)}
						<span class="chip-neutral">{tag}</span>
					{/each}
				</div>
			</div>
		</div>
	</a>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap items-center gap-1.5">
			{#each categories as value (value)}
				<button
					type="button"
					class="chip transition {category === value
						? 'border-bid/30 bg-bid/10 text-bid'
						: 'border-white/10 bg-white/[0.03] text-mist-400 hover:border-white/20 hover:text-mist-200'}"
					onclick={() => (category = value)}
				>
					{value}
					<span class="num ml-0.5 text-[9px] opacity-60">{countFor(value)}</span>
				</button>
			{/each}
		</div>
		<p class="num text-[10px] text-mist-600">{visible.length} of {rest.length} dispatches</p>
	</div>

	{#if visible.length}
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{#each visible as article (article.slug)}
				<a
					href="/news/{article.slug}"
					class="panel group flex flex-col overflow-hidden transition hover:border-white/15 hover:bg-white/[0.025]"
				>
					<div class="relative h-28 overflow-hidden border-b border-white/[0.06] bg-gradient-to-br {accentClass(
						article.accent
					)}">
						<div class="absolute inset-0 ledger-grid opacity-30"></div>
						<div class="absolute left-4 top-4 flex flex-wrap items-center gap-1.5">
							<span class="chip {categoryClass(article.category)}">{article.category}</span>
						</div>
						<div class="absolute bottom-3 right-4 opacity-80">
							<Icon name={article.icon} size={34} />
						</div>
					</div>

					<div class="flex flex-1 flex-col p-4">
						<h2
							class="text-base font-semibold leading-snug tracking-tight text-mist-100 transition group-hover:text-white"
						>
							{article.title}
						</h2>
						<p class="mt-2 line-clamp-3 flex-1 text-[11px] leading-relaxed text-mist-400">
							{article.excerpt}
						</p>

						<div
							class="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3 text-[10px] text-mist-500"
						>
							<span class="truncate">{article.author}</span>
							<span class="num shrink-0">{formatNewsDate(article.publishedAt)}</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<div class="panel flex flex-col items-center gap-2 px-5 py-14 text-center">
			<Icon name="news" size={22} class="text-mist-600" />
			<p class="text-xs font-semibold text-mist-300">No dispatches in this category yet</p>
			<button type="button" class="btn-ghost mt-2" onclick={() => (category = 'All')}>
				Show everything
			</button>
		</div>
	{/if}

	<section
		class="panel flex flex-col items-start justify-between gap-4 overflow-hidden p-5 sm:flex-row sm:items-center sm:p-6"
	>
		<div class="flex items-start gap-3">
			<span
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-300"
			>
				<Icon name="discord" size={18} />
			</span>
			<div>
				<h2 class="text-sm font-semibold text-mist-100">Get the next dispatch in Discord</h2>
				<p class="mt-1 max-w-lg text-[11px] leading-relaxed text-mist-400">
					Price alerts, new features and market notes land in the alert channel. The bot posts
					when the book actually moves — not every time someone blinks.
				</p>
			</div>
		</div>
		<a href="/discord" class="btn-primary shrink-0">
			<Icon name="bell" size={15} /> Set up alerts
		</a>
	</section>
</div>

<style>
	.ledger-grid {
		background-image:
			linear-gradient(to right, rgba(255, 255, 255, 0.09) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(255, 255, 255, 0.09) 1px, transparent 1px);
		background-size: 22px 22px;
	}
</style>
