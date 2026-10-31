<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import RichTextEditor from '../../../lib/components/RichTextEditor.svelte';
	import {
		NEWS_CATEGORIES,
		statusClass,
		statusLabel,
		type NewsArticle,
		type NewsCategory
	} from '../../../lib/news';
	import { loadNewsAuthor, newsAuthorHeaders } from '../../../lib/client/news-author.svelte';
	import { loadProfile, profile } from '../../../lib/client/profile.svelte';

	let articleId = $state('');
	let status = $state<'draft' | 'pending' | 'rejected' | 'published'>('draft');
	let title = $state('');
	let excerpt = $state('');
	let category = $state<NewsCategory>('Announcement');
	let authorName = $state('');
	let tagsInput = $state('');
	let bodyHtml = $state('<p></p>');
	let coverId = $state<string | null>(null);
	let coverUrl = $state<string | null>(null);
	let loading = $state(false);
	let saving = $state(false);
	let uploadingCover = $state(false);
	let error = $state('');
	let notice = $state('');

	const editId = $derived(page.url.searchParams.get('edit') ?? '');

	async function compress(file: File): Promise<File> {
		if (file.size <= 2.5 * 1024 * 1024) return file;
		try {
			const bitmap = await createImageBitmap(file);
			const max = 1600;
			const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
			const canvas = document.createElement('canvas');
			canvas.width = Math.max(1, Math.round(bitmap.width * scale));
			canvas.height = Math.max(1, Math.round(bitmap.height * scale));
			const context = canvas.getContext('2d');
			if (!context) return file;
			context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
			const blob = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, 'image/jpeg', 0.86)
			);
			if (!blob) return file;
			return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
		} catch {
			return file;
		}
	}

	async function uploadImage(file: File): Promise<string> {
		const prepared = await compress(file);
		if (prepared.size > 4 * 1024 * 1024) {
			throw new Error('That image is still larger than 4 MB. Try a smaller one.');
		}
		const form = new FormData();
		form.set('image', prepared);
		if (articleId) form.set('articleId', articleId);
		const response = await fetch('/api/news/media', {
			method: 'POST',
			headers: newsAuthorHeaders(),
			body: form
		});
		const payload = (await response.json()) as {
			media?: { url: string };
			error?: string;
		};
		if (!response.ok || !payload.media) {
			throw new Error(payload.error ?? 'The image could not be uploaded.');
		}
		return payload.media.url;
	}

	async function uploadCover(file: File): Promise<void> {
		uploadingCover = true;
		error = '';
		try {
			coverUrl = await uploadImage(file);
			coverId = coverUrl.split('/').pop() ?? null;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'The cover image could not be uploaded.';
		} finally {
			uploadingCover = false;
		}
	}

	async function loadArticle(id: string): Promise<void> {
		loading = true;
		error = '';
		try {
			const response = await fetch(`/api/news/${id}`, { headers: newsAuthorHeaders() });
			const payload = (await response.json()) as { article?: NewsArticle; error?: string };
			if (!response.ok || !payload.article) {
				throw new Error(payload.error ?? 'Could not open that article.');
			}
			const article = payload.article;
			articleId = article.id;
			status = article.status;
			title = article.title;
			excerpt = article.excerpt;
			category = article.category;
			authorName = article.author;
			tagsInput = article.tags.join(', ');
			bodyHtml = article.bodyHtml || '<p></p>';
			coverId = article.coverUrl?.split('/').pop() ?? null;
			coverUrl = article.coverUrl;
			if (article.status === 'published') {
				error = 'This article is already published. Create a new draft if you need to make a correction.';
			}
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not open that article.';
		} finally {
			loading = false;
		}
	}

	async function save(submit: boolean): Promise<void> {
		saving = true;
		error = '';
		notice = '';
		try {
			const payload = {
				title,
				excerpt,
				category,
				authorName,
				tags: tagsInput
					.split(',')
					.map((tag) => tag.trim())
					.filter(Boolean),
				bodyHtml,
				coverMediaId: coverId,
				submit
			};
			const response = await fetch(articleId ? `/api/news/${articleId}` : '/api/news', {
				method: articleId ? 'PATCH' : 'POST',
				headers: { 'content-type': 'application/json', ...newsAuthorHeaders() },
				body: JSON.stringify(payload)
			});
			const result = (await response.json()) as { article?: NewsArticle; error?: string };
			if (!response.ok || !result.article) {
				throw new Error(result.error ?? 'The article could not be saved.');
			}
			articleId = result.article.id;
			status = result.article.status;
			if (submit) {
				await goto('/news/mine');
				return;
			}
			notice = 'Draft saved.';
			if (editId !== articleId) {
				await goto(`/news/write?edit=${articleId}`, { replaceState: true });
			}
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'The article could not be saved.';
		} finally {
			saving = false;
		}
	}

	onMount(() => {
		loadNewsAuthor();
		loadProfile();
		if (editId) {
			void loadArticle(editId);
		} else {
			authorName = profile.ign || '';
		}
	});
</script>

<svelte:head>
	<title>Make an article · The Caeldun Ledger</title>
	<meta name="description" content="Write a dispatch for The Caeldun Ledger." />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto max-w-4xl">
	<header class="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
		<div>
			<p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-mist-500">The writing desk</p>
			<h2 class="mt-2 font-serif text-3xl font-semibold tracking-tight text-mist-100">
				{articleId ? 'Edit article' : 'Make an article'}
			</h2>
			<p class="mt-2 text-sm text-mist-400">
				Write it, add the images, then send it to a moderator. Images are never published until they
				are approved.
			</p>
		</div>
		<div class="flex items-center gap-2">
			{#if articleId}
				<span class="chip {statusClass(status)}">{statusLabel(status)}</span>
			{/if}
			<a href="/news/mine" class="btn-ghost btn-sm">Your articles</a>
		</div>
	</header>

	{#if loading}
		<p class="mt-10 text-center text-[10px] uppercase tracking-[0.2em] text-mist-500">Opening the article…</p>
	{:else}
		<form
			class="mt-7 space-y-6"
			onsubmit={(event) => {
				event.preventDefault();
				void save(false);
			}}
		>
			{#if error}
				<p class="border-l-2 border-danger/60 pl-3 text-xs text-danger">{error}</p>
			{/if}
			{#if notice}
				<p class="border-l-2 border-bid/60 pl-3 text-xs text-bid">{notice}</p>
			{/if}

			<div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
				<label class="block">
					<span class="label">Title</span>
					<input bind:value={title} class="input font-serif text-lg" maxlength="120" placeholder="A dispatch from Caeldun" />
				</label>
				<label class="block">
					<span class="label">Category</span>
					<select bind:value={category} class="select">
						{#each NEWS_CATEGORIES as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<label class="block">
					<span class="label">Byline</span>
					<input bind:value={authorName} class="input" maxlength="40" placeholder="Your name or IGN" />
				</label>
				<label class="block">
					<span class="label">Tags <span class="font-normal text-mist-500">comma separated</span></span>
					<input bind:value={tagsInput} class="input" placeholder="market, trade routes, event" />
				</label>
			</div>

			<label class="block">
				<span class="label">Summary <span class="font-normal text-mist-500">shown on the front page</span></span>
				<textarea
					bind:value={excerpt}
					class="textarea"
					maxlength="320"
					rows="3"
					placeholder="One or two lines that tell readers why this matters."
				></textarea>
			</label>

			<div>
				<span class="label">Cover image <span class="font-normal text-mist-500">optional, reviewed</span></span>
				{#if coverUrl}
					<div class="relative overflow-hidden rounded-sm border border-white/10">
						<img src={coverUrl} alt="" class="max-h-64 w-full object-cover" />
						<button
							type="button"
							class="btn-ghost btn-sm absolute right-2 top-2 bg-ink-950/80"
							onclick={() => {
								coverId = null;
								coverUrl = null;
							}}
						>
							Remove
						</button>
					</div>
				{:else}
					<label class="flex cursor-pointer items-center justify-center border border-dashed border-white/15 px-4 py-8 text-xs text-mist-500 transition hover:border-white/30 hover:text-mist-200">
						<input
							type="file"
							accept="image/*"
							class="hidden"
							onchange={(event) => {
								const file = event.currentTarget.files?.[0];
								if (file) void uploadCover(file);
								event.currentTarget.value = '';
							}}
						/>
						{uploadingCover ? 'Uploading…' : 'Choose a cover image'}
					</label>
				{/if}
			</div>

			<div>
				<span class="label">Article</span>
				<RichTextEditor value={bodyHtml} onChange={(html) => (bodyHtml = html)} onUpload={uploadImage} disabled={saving} />
			</div>

			<p class="border-l-2 border-ask/50 pl-3 text-[11px] leading-relaxed text-mist-500">
				Images remain in a private review queue until a moderator approves them. An article with an
				unapproved image cannot be published.
			</p>

			<div class="flex flex-wrap items-center gap-2 border-t border-white/[0.08] pt-5">
				<button type="submit" class="btn-ghost" disabled={saving}>
					{saving ? 'Saving…' : 'Save draft'}
				</button>
				<button
					type="button"
					class="btn-primary"
					disabled={saving || status === 'published'}
					onclick={() => void save(true)}
				>
					{saving ? 'Sending…' : 'Send to review'}
				</button>
				<a href="/news/mine" class="btn-quiet">Cancel</a>
			</div>
		</form>
	{/if}
</div>
