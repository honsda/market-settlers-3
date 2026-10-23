<script lang="ts">
	import { page } from '$app/state';
	import Icon from '../lib/components/Icon.svelte';

	const notFound = $derived(page.status === 404);
	const title = $derived(notFound ? 'This stall is empty' : 'Something went sideways');
	const message = $derived(
		notFound
			? 'The page you were looking for is not on the market board. It may have moved or been cancelled.'
			: page.error?.message || 'The market hit an unexpected error. Try again in a moment.'
	);
</script>

<svelte:head>
	<title>{page.status} · Settlers Market</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-[68vh] items-center justify-center py-10">
	<div class="panel relative w-full max-w-md overflow-hidden px-6 py-10 text-center sm:px-10">
		<div
			class="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(18rem_9rem_at_50%_0%,rgba(52,211,153,0.12),transparent_70%)]"
		></div>

		<div class="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-mist-300">
			{#if notFound}
				<Icon name="compass" size={26} />
			{:else}
				<Icon name="alert" size={26} class="text-danger" />
			{/if}
		</div>

		<p class="num mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-mist-500">
			Error {page.status}
		</p>
		<h1 class="mt-1.5 text-xl font-bold tracking-tight text-mist-100">{title}</h1>
		<p class="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-mist-400">{message}</p>

		<div class="mt-6 flex flex-wrap items-center justify-center gap-2">
			<a href="/" class="btn-primary">
				<Icon name="dashboard" size={15} /> Back to dashboard
			</a>
			<a href="/market" class="btn-ghost">
				<Icon name="market" size={15} /> Browse markets
			</a>
		</div>

		{#if !notFound}
			<p class="mt-5 text-[10px] text-mist-600">
				If this keeps happening, check the server console or restart the web app.
			</p>
		{/if}
	</div>
</div>
