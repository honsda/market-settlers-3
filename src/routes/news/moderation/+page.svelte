<script lang="ts">
	import { onMount } from 'svelte';
	import {
		formatNewsDate,
		statusClass,
		statusLabel,
		stripHtml,
		type NewsArticle,
		type NewsMedia
	} from '../../../lib/news';

	const KEY_STORAGE = 'ms3.news-moderator-key.v1';
	let key = $state('');
	let unlocked = $state(false);
	let loading = $state(false);
	let error = $state('');
	let notice = $state('');
	let articles = $state<NewsArticle[]>([]);
	let media = $state<NewsMedia[]>([]);
	let busy = $state('');

	const unattachedMedia = $derived(media.filter((image) => !image.articleId));

	async function request(path = '', init?: RequestInit): Promise<Response> {
		return fetch(`/api/news/moderation${path}`, {
			...init,
			headers: {
				...(init?.headers ?? {}),
				'x-news-moderator-key': key
			}
		});
	}

	async function refresh(): Promise<void> {
		if (!key) return;
		loading = true;
		error = '';
		try {
			const response = await request();
			const payload = (await response.json()) as {
				articles?: NewsArticle[];
				media?: NewsMedia[];
				error?: string;
			};
			if (!response.ok) throw new Error(payload.error ?? 'Could not open the moderation desk.');
			unlocked = true;
			articles = payload.articles ?? [];
			media = payload.media ?? [];
			try {
				sessionStorage.setItem(KEY_STORAGE, key);
			} catch {
				// The key still works for this session.
			}
		} catch (cause) {
			unlocked = false;
			error = cause instanceof Error ? cause.message : 'Could not open the moderation desk.';
		} finally {
			loading = false;
		}
	}

	async function review(
		kind: 'article' | 'media',
		id: string,
		action: 'approve' | 'reject'
	): Promise<void> {
		let note: string | null = null;
		if (action === 'reject') {
			const reason = window.prompt('Optional reason for the author:');
			if (reason === null) return;
			note = reason.trim() || null;
		}
		busy = `${kind}:${id}`;
		error = '';
		notice = '';
		try {
			const response = await request('', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind, id, action, note })
			});
			const payload = (await response.json()) as { error?: string };
			if (!response.ok) throw new Error(payload.error ?? 'The review could not be saved.');
			notice = action === 'approve' ? 'Approved.' : 'Rejected.';
			await refresh();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'The review could not be saved.';
		} finally {
			busy = '';
		}
	}

	function imageStatus(image: NewsMedia): string {
		return `${image.filename} (${image.status})`;
	}

	onMount(() => {
		try {
			const saved = sessionStorage.getItem(KEY_STORAGE);
			if (saved) {
				key = saved;
				void refresh();
			}
		} catch {
			// Ignore storage restrictions.
		}
	});
</script>

<svelte:head>
	<title>Moderation · The Caeldun Ledger</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto max-w-4xl">
	<header class="border-b border-white/[0.08] pb-5">
		<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-mist-500">Staff desk</p>
		<h2 class="mt-2 font-serif text-3xl font-semibold tracking-tight text-mist-100">Moderation</h2>
		<p class="mt-2 max-w-2xl text-sm text-mist-400">
			Approve images before they can appear in an article. Articles can publish once every attached
			image is approved.
		</p>
	</header>

	{#if !unlocked}
		<form
			class="mt-6 flex max-w-md flex-wrap items-end gap-2"
			onsubmit={(event) => {
				event.preventDefault();
				void refresh();
			}}
		>
			<label class="min-w-0 flex-1">
				<span class="label">Moderator key</span>
				<input bind:value={key} type="password" class="input" autocomplete="current-password" />
			</label>
			<button type="submit" class="btn-primary" disabled={loading || !key}>
				{loading ? 'Checking…' : 'Open desk'}
			</button>
		</form>
	{:else}
		<div class="mt-6 flex flex-wrap items-center gap-2">
			<button type="button" class="btn-ghost btn-sm" onclick={() => void refresh()} disabled={loading}>
				{loading ? 'Refreshing…' : 'Refresh queue'}
			</button>
			<button
				type="button"
				class="btn-quiet btn-sm"
				onclick={() => {
					key = '';
					unlocked = false;
					articles = [];
					media = [];
					try {
						sessionStorage.removeItem(KEY_STORAGE);
					} catch {
						// ignore
					}
				}}
			>
				Lock desk
			</button>
			<span class="text-[10px] text-mist-500">{articles.length} article(s) waiting · {media.length} image(s)</span>
		</div>
	{/if}

	{#if error}
		<p class="mt-5 border-l-2 border-danger/60 pl-3 text-xs text-danger">{error}</p>
	{/if}
	{#if notice}
		<p class="mt-5 border-l-2 border-bid/60 pl-3 text-xs text-bid">{notice}</p>
	{/if}

	{#if unlocked}
		<section class="mt-8">
			<h3 class="text-[10px] font-semibold uppercase tracking-[0.22em] text-mist-500">Articles in review</h3>
			{#if !articles.length}
				<p class="mt-4 border-y border-white/[0.08] py-8 text-center text-sm text-mist-500">
					No articles are waiting.
				</p>
			{:else}
				<div class="mt-4 space-y-6">
					{#each articles as article (article.id)}
						{@const blocked = article.media.some((image) => image.status !== 'approved')}
						<article class="border border-white/[0.08] p-4">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<span class="chip {statusClass(article.status)}">{statusLabel(article.status)}</span>
										<span class="text-[10px] text-mist-500">
											By {article.author} · {formatNewsDate(article.updatedAt)}
										</span>
									</div>
									<h4 class="mt-2 font-serif text-xl font-semibold text-mist-100">{article.title}</h4>
									<p class="mt-1 text-[12px] leading-relaxed text-mist-500">{article.excerpt}</p>
									<p class="mt-3 line-clamp-3 text-[12px] leading-relaxed text-mist-400">
										{stripHtml(article.bodyHtml)}
									</p>
								</div>
								<div class="flex shrink-0 flex-wrap gap-2">
									<button
										type="button"
										class="btn-primary btn-sm"
										disabled={blocked || busy === `article:${article.id}`}
										title={blocked ? 'Approve the images first' : 'Publish this article'}
										onclick={() => void review('article', article.id, 'approve')}
									>
										Publish
									</button>
									<button
										type="button"
										class="btn-danger btn-sm"
										disabled={busy === `article:${article.id}`}
										onclick={() => void review('article', article.id, 'reject')}
									>
										Reject
									</button>
								</div>
							</div>

							{#if article.media.length}
								<div class="mt-4 flex flex-wrap gap-3 border-t border-white/[0.07] pt-3">
									{#each article.media as image (image.id)}
										<div class="w-40">
											<img src={image.url} alt="" class="h-24 w-full border border-white/10 object-cover" />
											<p class="mt-1 truncate text-[10px] text-mist-500" title={imageStatus(image)}>
												{image.filename} · {image.status}
											</p>
											{#if image.status === 'pending'}
												<div class="mt-1 flex gap-1">
													<button
														type="button"
														class="btn-primary btn-sm flex-1"
														onclick={() => void review('media', image.id, 'approve')}
													>
														Approve
													</button>
													<button
														type="button"
														class="btn-danger btn-sm flex-1"
														onclick={() => void review('media', image.id, 'reject')}
													>
														Reject
													</button>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
							{#if blocked}
								<p class="mt-3 text-[10px] text-ask">Approve or remove every image before publishing.</p>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</section>

		<section class="mt-10">
			<h3 class="text-[10px] font-semibold uppercase tracking-[0.22em] text-mist-500">Unattached images</h3>
			{#if !unattachedMedia.length}
				<p class="mt-4 border-y border-white/[0.08] py-8 text-center text-sm text-mist-500">
					No unattached images are waiting.
				</p>
			{:else}
				<div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each unattachedMedia as image (image.id)}
						<div class="border border-white/[0.08] p-2">
							<img src={image.url} alt="" class="h-32 w-full border border-white/10 object-cover" />
							<p class="mt-2 truncate text-[10px] text-mist-400" title={image.filename}>{image.filename}</p>
							<p class="text-[10px] text-mist-600">{formatNewsDate(image.createdAt)}</p>
							<div class="mt-2 flex gap-1">
								<button
									type="button"
									class="btn-primary btn-sm flex-1"
									onclick={() => void review('media', image.id, 'approve')}
								>
									Approve
								</button>
								<button
									type="button"
									class="btn-danger btn-sm flex-1"
									onclick={() => void review('media', image.id, 'reject')}
								>
									Reject
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>
