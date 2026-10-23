<script lang="ts">
	import { getItem, type Alert } from '../market';
	import { formatPct, formatPrice, timeAgo } from '../format';
	import ItemIcon from './ItemIcon.svelte';
	import Icon from './Icon.svelte';

	let { alert, compact = false }: { alert: Alert; compact?: boolean } = $props();

	const item = $derived(getItem(alert.itemId));
	const positive = $derived(alert.kind === 'price-up' || alert.kind === 'new-high');
	const label = $derived(
		alert.kind === 'price-up'
			? 'Price up'
			: alert.kind === 'price-down'
				? 'Price down'
				: alert.kind === 'new-high'
					? '7d high'
					: '7d low'
	);
</script>

<div class="flex gap-3 {compact ? 'px-4 py-3' : 'p-3.5'}">
	{#if item}
		<ItemIcon item={item} size={compact ? 28 : 32} />
	{/if}
	<div class="min-w-0 flex-1">
		<div class="flex flex-wrap items-center gap-1.5">
			<span class={positive ? 'chip-bid' : 'chip-danger'}>
				<Icon name={positive ? 'trendUp' : 'trendDown'} size={10} />
				{label}
			</span>
			{#if alert.changePct !== null}
				<span class="num text-[10px] font-semibold {positive ? 'text-bid' : 'text-danger'}">
					{formatPct(alert.changePct)}
				</span>
			{/if}
			<span class="ml-auto text-[10px] text-mist-600">{timeAgo(alert.createdAt)}</span>
		</div>
		<p class="mt-1.5 text-[11px] leading-relaxed text-mist-300">
			{alert.message}
		</p>
		<div class="mt-1 flex items-center gap-2 text-[10px] text-mist-600">
			<span class="num">{formatPrice(alert.price)} coins</span>
			{#if alert.previous !== null}
				<span>· was {formatPrice(alert.previous)}</span>
			{/if}
			{#if alert.postedAt}
				<span class="ml-auto flex items-center gap-1 text-bid/70">
					<Icon name="discord" size={10} /> posted
				</span>
			{/if}
		</div>
	</div>
</div>
