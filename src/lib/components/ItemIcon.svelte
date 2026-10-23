<script lang="ts">
	import { itemTexture, type Item } from '../market';
	import Icon from './Icon.svelte';

	let {
		item,
		size = 28,
		class: className = '',
		glow = false
	}: { item: Item; size?: number; class?: string; glow?: boolean } = $props();

	let failed = $state(false);
</script>

<div
	class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-ink-950/80 {className}"
	style:width="{size}px"
	style:height="{size}px"
	title={item.name}
>
	{#if failed}
		<Icon name="package" size={Math.round(size * 0.55)} class="text-mist-500" />
	{:else}
		<img
			src={itemTexture(item)}
			alt={item.name}
			width={size}
			height={size}
			loading="lazy"
			decoding="async"
			class="h-full w-full object-contain p-[14%]"
			style:image-rendering="pixelated"
			style:filter={glow ? 'drop-shadow(0 0 7px rgba(52,211,153,0.42))' : undefined}
			onerror={() => (failed = true)}
		/>
	{/if}
</div>
