<script lang="ts">
	import { live } from '../client/live.svelte';

	let { compact = false }: { compact?: boolean } = $props();
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold {live.connected
		? 'text-mist-300'
		: 'text-ask'}"
	title={live.connected ? 'Connected to live market updates' : 'Reconnecting to live updates…'}
>
	<span
		class="h-1.5 w-1.5 rounded-full {live.connected ? 'bg-bid' : 'bg-ask'}"
		class:pulse-dot={live.connected}
	></span>
	{#if !compact}{live.connected ? 'Live market' : 'Reconnecting'}{/if}
</span>
