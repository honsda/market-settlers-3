<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import { cn } from '../format';

	let {
		label,
		value,
		hint,
		icon,
		tone = 'neutral',
		children
	}: {
		label: string;
		value: string;
		hint?: string;
		icon: string;
		tone?: 'neutral' | 'bid' | 'ask';
		children?: Snippet;
	} = $props();
</script>

<div class="panel group relative overflow-hidden p-4">
	<div
		class="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full blur-2xl transition group-hover:opacity-90
			{tone === 'bid' ? 'bg-bid/10' : tone === 'ask' ? 'bg-ask/10' : 'bg-white/[0.04]'}"
	></div>

	<div class="relative flex items-start justify-between gap-3">
		<div
			class={cn(
				'flex h-9 w-9 items-center justify-center rounded-xl border',
				tone === 'bid'
					? 'border-bid/25 bg-bid/10 text-bid'
					: tone === 'ask'
						? 'border-ask/25 bg-ask/10 text-ask'
						: 'border-white/10 bg-white/[0.04] text-mist-300'
			)}
		>
			<Icon name={icon} size={17} />
		</div>
		{#if children}
			<div class="min-w-0">{@render children()}</div>
		{/if}
	</div>

	<p class="relative mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">{label}</p>
	<p class="num relative mt-1 text-2xl font-semibold tracking-tight text-mist-100">{value}</p>
	{#if hint}
		<p class="relative mt-1 text-[11px] text-mist-500">{hint}</p>
	{/if}
</div>
