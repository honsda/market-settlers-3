<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		src,
		title = 'Settlers III world map',
		heightClass = 'h-[420px]',
		class: className = '',
		overlay
	}: {
		src: string;
		title?: string;
		heightClass?: string;
		class?: string;
		overlay?: Snippet;
	} = $props();

	let loading = $state(true);

	$effect(() => {
		src;
		loading = true;
	});
</script>

<div
	class="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900 {heightClass} {className}"
>
	{#if loading}
		<div class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-ink-900">
			<div class="relative flex h-12 w-12 items-center justify-center">
				<span class="absolute inset-0 animate-ping rounded-full bg-bid/10"></span>
				<span class="flex h-10 w-10 items-center justify-center rounded-full border border-bid/25 bg-bid/10 text-bid">
					<Icon name="map" size={18} />
				</span>
			</div>
			<div class="text-center">
				<p class="text-xs font-semibold text-mist-300">Waking up {title}</p>
				<p class="mt-1 text-[10px] text-mist-500">Streaming live chunks from play.settlers-mc.org</p>
			</div>
		</div>
	{/if}

	<iframe
		{src}
		{title}
		class="h-full w-full border-0 bg-ink-900"
		loading="eager"
		referrerpolicy="no-referrer-when-downgrade"
		allow="fullscreen"
		onload={() => (loading = false)}
	></iframe>

	{#if overlay}
		<div class="pointer-events-none absolute inset-0 z-20">
			<div class="pointer-events-auto">
				{@render overlay()}
			</div>
		</div>
	{/if}

	<div class="absolute bottom-3 left-3 z-20">
		<a
			href={src}
			target="_blank"
			rel="noreferrer"
			class="flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-950/80 px-2.5 py-1 text-[10px] font-medium text-mist-300 backdrop-blur transition hover:border-bid/30 hover:text-bid"
		>
			<span class="h-1.5 w-1.5 rounded-full bg-bid"></span>
			play.settlers-mc.org
			<Icon name="external" size={10} />
		</a>
	</div>
</div>
