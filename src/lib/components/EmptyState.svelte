<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		icon = 'market',
		title,
		description,
		action
	}: { icon?: string; title: string; description: string; action?: Snippet } = $props();
</script>

<div class="flex flex-col items-center gap-3 px-6 py-12 text-center">
	<span
		class="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-mist-500"
	>
		<Icon name={icon} size={21} />
	</span>
	<div>
		<p class="text-sm font-semibold text-mist-200">{title}</p>
		<p class="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-mist-500">{description}</p>
	</div>
	{#if action}
		{@render action()}
	{/if}
</div>
