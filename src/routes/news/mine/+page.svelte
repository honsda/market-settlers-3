<script lang="ts">
	import { onMount } from 'svelte';
	import {
		formatNewsDate,
		statusClass,
		statusLabel,
		type NewsArticle
	} from '../../../lib/news';
	import { loadNewsAuthor, newsAuthorHeaders } from '../../../lib/client/news-author.svelte';

	let articles = $state<NewsArticle[]>([]);
	let loading = $state(true);
	let error = $state('');
	let busy = $state('');

	async function load(): Promise<void> {
		loadNewsAuthor();
		loading = true;
		error = '';
		try {
			const response = await fetch('/api/news/mine', { headers: newsAuthorHeaders() });
			const payload = (await response.json()) as { articles?: NewsArticle[]; error?: string };
			if (!response.ok) throw new Error(payload.error ?? 'Could not load your articles.');
			articles = payload.articles ?? [];
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not load your articles.';
		} finally {
			loading = false;
		}
	}

	async function submit(article: NewsArticle): Promise<void> {
		busy = article.id;
		error = '';
		try {
			const response = await fetch(`/api/news/${article.id}/submit`, {
				method: 'POST',
				headers: newsAuthorHeaders()
			});
			const payload = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(payload.error ?? 'Could not submit the article.');
			await load();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not submit the article.';
		} finally {
			busy = '';
		}
	}

	async function remove(article: NewsArticle): Promise<void> {
		if (!window.confirm(`Delete “${article.title}”? This cannot be undone.`)) return;
		busy = article.id;
		error = '';
		try {
			const response = await fetch(`/api/news/${article.id}`, {
				method: 'DELETE',
				headers: newsAuthorHeaders()
			});
			const payload = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(payload.error ?? 'Could not delete the article.');
			await load();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not delete the article.';
		} finally {
			busy = '';
		}
	}

	onMount(() => {
		void load();
	});
</script>

<svelte:head>
	<title>Your articles · The Caeldun Ledger</title>
	<meta name="description" content="Drafts, review status and published dispatches from your newsroom." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto max-w-3xl">
	<header class="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
		<div>
			<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-mist-500">Your desk</p>
			<h2 class="mt-2 font-serif text-3xl font-semibold tracking-tight text-mist-100">Your articles</h2>
			<p class="mt-2 text-sm text-mist-400">Drafts, review notes and everything you have sent to press.</p>
		</div>
		<a href="/news/write" class="btn-primary btn-sm">Make an article</a>
	</header>

	{#if error}
		<p class="mt-5 border-l-2 border-danger/60 pl-3 text-xs text-danger">{error}</p>
	{/if}

	{#if loading}
		<p class="mt-10 text-center text-[10px] uppercase tracking-[0.2em] text-mist-500">Opening your desk…</p>
	{:else if !articles.length}
		<div class="mt-10 border-y border-white/[0.08] py-16 text-center">
			<p class="font-serif text-2xl text-mist-200">Nothing on your desk yet.</p>
			<p class="mx-auto mt-2 max-w-sm text-sm text-mist-500">
				Write a dispatch. Images are held for moderator review before the article can be published.
			</p>
			<a href="/news/write" class="btn-primary mt-5">Make an article</a>
		</div>
	{:else}
		<div class="mt-6 divide-y divide-white/[0.07] border-y border-white/[0.08]">
			{#each articles as article (article.id)}
				<article class="py-5">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<span class="chip {statusClass(article.status)}">{statusLabel(article.status)}</span>
								<span class="text-[10px] text-mist-500">{formatNewsDate(article.updatedAt)}</span>
							</div>
							<h3 class="mt-2 font-serif text-xl font-semibold leading-snug text-mist-100">
								{#if article.status === 'published'}
									<a href="/news/{article.slug}" class="transition hover:text-white">{article.title}</a>
								{:else}
									{article.title}
								{/if}
							</h3>
							<p class="mt-1 max-w-xl text-[12px] leading-relaxed text-mist-500">{article.excerpt}</p>
							{#if article.reviewNote}
								<p class="mt-2 border-l-2 border-danger/50 pl-2 text-[11px] text-danger">
									{article.reviewNote}
								</p>
							{/if}
						</div>
						<div class="flex shrink-0 flex-wrap gap-2">
							{#if article.status === 'draft' || article.status === 'rejected'}
								<a href="/news/write?edit={article.id}" class="btn-ghost btn-sm">Edit</a>
								<button
									type="button"
									class="btn-primary btn-sm"
									disabled={busy === article.id}
									onclick={() => void submit(article)}
								>
									{busy === article.id ? 'Sending…' : 'Send to review'}
								</button>
								<button
									type="button"
									class="btn-quiet btn-sm text-danger"
									disabled={busy === article.id}
									onclick={() => void remove(article)}
								>
									Delete
								</button>
							{:else if article.status === 'published'}
								<a href="/news/{article.slug}" class="btn-ghost btn-sm">Read</a>
							{:else}
								<span class="text-[10px] text-mist-500">Waiting for a moderator</span>
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}

	<div class="mt-8 flex flex-wrap gap-4 text-[10px] text-mist-600">
		<a href="/news" class="transition hover:text-mist-300">Recent articles</a>
		<a href="/news/paper" class="transition hover:text-mist-300">Newspaper</a>
		<button type="button" class="transition hover:text-mist-300" onclick={() => void load()}>Refresh</button>
	</div>
</div>
