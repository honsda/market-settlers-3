<script lang="ts">
	import { getItem, type ItemMarket } from '../market';
	import { formatPct, formatPrice } from '../format';
	import Icon from './Icon.svelte';
	import ItemIcon from './ItemIcon.svelte';
	import Sparkline from './Sparkline.svelte';

	let { items }: { items: ItemMarket[] } = $props();

	const movers = $derived(
		items
			.filter((entry) => entry.changePct !== null && entry.history.length > 1)
			.sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
			.slice(0, 4)
	);

	const biggest = $derived(items.reduce((max, entry) => Math.max(max, entry.history.length), 0));
</script>

<section class="panel overflow-hidden">
	<div class="panel-header">
		<div class="flex items-center gap-3">
			<span
				class="flex h-9 w-9 items-center justify-center rounded-xl border border-ask/20 bg-ask/10 text-ask"
			>
				<Icon name="activity" size={17} />
			</span>
			<div>
				<h2 class="text-sm font-semibold tracking-tight text-mist-100">Market pulse</h2>
				<p class="text-[11px] text-mist-500">Biggest 24h moves</p>
			</div>
		</div>
		<a href="/market" class="text-[11px] font-medium text-mist-500 transition hover:text-bid">All items</a>
	</div>

	{#if movers.length}
		<div class="divide-y divide-white/[0.05]">
			{#each movers as entry (entry.itemId)}
				{@const item = getItem(entry.itemId)}
				{#if item}
					<a
						href="/market?item={entry.itemId}"
						class="group flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
					>
						<ItemIcon item={item} size={30} />
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-semibold text-mist-200">{item.name}</p>
							<p class="num mt-0.5 text-[11px] text-mist-500">{formatPrice(entry.mid)} coins</p>
						</div>
						<div class="hidden w-16 sm:block">
							<Sparkline values={entry.history.slice(-24).map((point) => point.mid)} height={20} fill={false} />
						</div>
						<span
							class="num flex items-center gap-0.5 text-[11px] font-semibold {entry.changePct !== null &&
							entry.changePct >= 0
								? 'text-bid'
								: 'text-danger'}"
						>
							<Icon name={entry.changePct !== null && entry.changePct >= 0 ? 'trendUp' : 'trendDown'} size={12} />
							{formatPct(entry.changePct)}
						</span>
					</a>
				{/if}
			{/each}
		</div>
	{:else}
		<div class="flex flex-col items-center gap-2 px-5 py-10 text-center">
			<Icon name="activity" size={22} class="text-mist-600" />
			<p class="text-xs text-mist-400">Price moves appear here once the board has a day of history.</p>
			<p class="text-[11px] text-mist-600">Post a few offers to start the tape.</p>
		</div>
	{/if}

	<div class="flex items-center justify-between border-t border-white/[0.06] bg-ink-950/25 px-4 py-2.5 text-[10px] text-mist-600">
		<span>{biggest} snapshots tracked</span>
		<span class="flex items-center gap-1"><Icon name="bell" size={10} /> alerts on Discord</span>
	</div>
</section>
