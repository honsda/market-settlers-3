<script lang="ts">
	import { onMount } from 'svelte';
	import { getJSON } from '../client/api';
	import { getItem } from '../market';
	import { formatPct, formatPrice, formatQty, timeAgo } from '../format';
	import { WIKI_MARKET_PAGE, wikiRegionName, type WikiMarketSnapshot } from '../wiki-market';
	import Icon from './Icon.svelte';
	import ItemIcon from './ItemIcon.svelte';

	let data = $state<WikiMarketSnapshot | null>(null);
	let loading = $state(true);
	let error = $state('');
	let query = $state('');
	let sort = $state<'volume' | 'change' | 'price' | 'name'>('volume');
	let timer: ReturnType<typeof setInterval> | null = null;

	async function load() {
		try {
			data = await getJSON<WikiMarketSnapshot>('/api/wiki-market');
			error = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load the live shop feed.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void load();
		timer = setInterval(() => void load(), 60_000);
		return () => {
			if (timer) clearInterval(timer);
		};
	});

	const rows = $derived.by(() => {
		if (!data) return [];
		const search = query.trim().toLowerCase();
		const filtered = data.items.filter((item) => {
			if (!search) return true;
			return item.name.toLowerCase().includes(search) || item.key.toLowerCase().includes(search);
		});
		const sorted = filtered.sort((a, b) => {
			if (sort === 'name') return a.name.localeCompare(b.name);
			if (sort === 'change') {
				return Math.abs(b.changePct ?? -1) - Math.abs(a.changePct ?? -1);
			}
			if (sort === 'price') {
				return (a.bestAsk ?? Number.MAX_SAFE_INTEGER) - (b.bestAsk ?? Number.MAX_SAFE_INTEGER);
			}
			return b.gold24h - a.gold24h || b.sold24h - a.sold24h || a.name.localeCompare(b.name);
		});
		return sorted.slice(0, search ? 60 : 24);
	});

	function changeClass(value: number | null): string {
		if (value === null) return 'text-mist-500';
		return value >= 0 ? 'text-bid' : 'text-danger';
	}
</script>

<section class="panel overflow-hidden">
	<div class="panel-header flex-wrap gap-3">
		<div class="flex items-center gap-3">
			<span
				class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-mist-200"
			>
				<Icon name="globe" size={17} />
			</span>
			<div>
				<h2 class="text-sm font-semibold tracking-tight text-mist-100">Live shop prices</h2>
				<p class="text-[11px] text-mist-500">
					{#if data}
						Official server feed · updated {timeAgo(data.generated)}
					{:else}
						Loading the official server feed…
					{/if}
				</p>
			</div>
		</div>

		<div class="flex items-center gap-2">
			{#if error && data}
				<span class="text-[10px] font-semibold text-danger">Feed delayed</span>
			{/if}
			<span
				class="inline-flex items-center gap-1.5 rounded-full border border-bid/25 bg-bid/10 px-2.5 py-1 text-[10px] font-semibold text-bid"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-bid"></span> Live
			</span>
			<a
				href={WIKI_MARKET_PAGE}
				target="_blank"
				rel="noreferrer"
				class="btn-ghost btn-sm"
			>
				<Icon name="external" size={13} /> Wiki
			</a>
		</div>
	</div>

	{#if loading && !data}
		<div class="space-y-3 p-5">
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{#each [0, 1, 2, 3] as index (index)}
					<div class="skeleton h-16"></div>
				{/each}
			</div>
			<div class="skeleton h-56"></div>
		</div>
	{:else if !data}
		<div class="flex flex-col items-center gap-3 px-6 py-14 text-center">
			<Icon name="wifiOff" size={22} class="text-danger" />
			<p class="text-sm font-semibold text-mist-200">Could not load the live shop feed</p>
			<p class="text-xs text-mist-500">{error}</p>
			<button
				type="button"
				class="btn-primary"
				onclick={() => {
					loading = true;
					void load();
				}}
			>
				<Icon name="refresh" size={14} /> Retry
			</button>
		</div>
	{:else}
		<div class="grid gap-3 p-5 pb-0 sm:grid-cols-2 xl:grid-cols-4">
			<div class="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
				<p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">Shops open</p>
				<p class="num mt-1 text-lg font-semibold text-mist-100">{formatQty(data.shopsOpen)}</p>
				<p class="text-[10px] text-mist-600">of {formatQty(data.shopsTotal)} keepers</p>
			</div>
			<div class="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
				<p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">Items for sale</p>
				<p class="num mt-1 text-lg font-semibold text-mist-100">{formatQty(data.itemsForSale)}</p>
				<p class="text-[10px] text-mist-600">{formatQty(data.itemsForSaleKinds)} different items</p>
			</div>
			<div class="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
				<p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">Sold 24h</p>
				<p class="num mt-1 text-lg font-semibold text-mist-100">{formatQty(data.itemsSold24h)}</p>
				<p class="text-[10px] text-mist-600">{formatQty(data.trades24h)} trades · {formatQty(data.activeItems24h)} items</p>
			</div>
			<div class="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
				<p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">Gold traded 24h</p>
				<p class="num mt-1 text-lg font-semibold text-mist-100">{formatPrice(data.goldTraded24h)}</p>
				<p class="text-[10px] text-mist-600">gold nuggets</p>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2 px-5 py-4">
			<label class="relative min-w-[200px] flex-1">
				<Icon name="search" size={14} class="pointer-events-none absolute left-3 top-2.5 text-mist-500" />
				<input
					class="input py-2 pl-9 text-xs"
					placeholder="Find an item…"
					bind:value={query}
					aria-label="Find a shop item"
				/>
			</label>
			<select class="select w-auto py-2 text-xs" bind:value={sort} aria-label="Sort shop items">
				<option value="volume">Sort: activity</option>
				<option value="change">Sort: 24h move</option>
				<option value="price">Sort: cheapest ask</option>
				<option value="name">Sort: name</option>
			</select>
		</div>

		<div class="overflow-x-auto border-t border-white/[0.06]">
			<table class="w-full min-w-[760px] text-left text-xs">
				<thead class="bg-white/[0.02] text-[10px] uppercase tracking-[0.12em] text-mist-500">
					<tr>
						<th class="px-5 py-2.5 font-semibold">Item</th>
						<th class="px-3 py-2.5 text-right font-semibold">Wanted</th>
						<th class="px-3 py-2.5 text-right font-semibold">For sale</th>
						<th class="px-3 py-2.5 text-right font-semibold">Last sale</th>
						<th class="px-3 py-2.5 text-right font-semibold">24h volume</th>
						<th class="px-3 py-2.5 text-right font-semibold">24h avg</th>
						<th class="px-5 py-2.5 text-right font-semibold">24h move</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-white/[0.05]">
					{#each rows as row (row.key)}
						{@const item = row.itemId ? getItem(row.itemId) : undefined}
						<tr class="transition hover:bg-white/[0.025]">
							<td class="px-5 py-2.5">
								<div class="flex items-center gap-2.5">
									{#if item}
										<ItemIcon {item} size={24} />
									{:else}
										<span
											class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-ink-950/80 text-mist-500"
										>
											<Icon name="package" size={13} />
										</span>
									{/if}
									<div class="min-w-0">
										<p class="truncate font-semibold text-mist-200">{row.name}</p>
										<p class="truncate text-[10px] text-mist-600">
											{row.askShops} shops · {formatQty(row.stock)} in stock
										</p>
									</div>
								</div>
							</td>
							<td class="px-3 py-2.5 text-right">
								<p class="num text-mist-300">
									{row.bestBid === null ? '—' : formatPrice(row.bestBid)}
								</p>
								<p class="text-[10px] text-mist-600">
									{row.bestBidRegion === null ? '—' : wikiRegionName(row.bestBidRegion)}
								</p>
							</td>
							<td class="px-3 py-2.5 text-right">
								<p class="num text-mist-300">
									{row.bestAsk === null ? '—' : formatPrice(row.bestAsk)}
								</p>
								<p class="text-[10px] text-mist-600">
									{row.bestAskRegion === null ? '—' : wikiRegionName(row.bestAskRegion)}
								</p>
							</td>
							<td class="px-3 py-2.5 text-right">
								<p class="num text-mist-200">
									{row.lastPrice === null ? '—' : formatPrice(row.lastPrice)}
								</p>
								<p class="text-[10px] text-mist-600">
									{row.lastTradeAt ? timeAgo(row.lastTradeAt) : '—'}
								</p>
							</td>
							<td class="px-3 py-2.5 text-right">
								<p class="num text-mist-200">{formatQty(row.sold24h)}</p>
								<p class="text-[10px] text-mist-600">{formatQty(row.trades24h)} trades</p>
							</td>
							<td class="num px-3 py-2.5 text-right text-mist-300">
								{row.avg24h === null ? '—' : formatPrice(row.avg24h)}
							</td>
							<td class="px-5 py-2.5 text-right">
								<span class="num font-semibold {changeClass(row.changePct)}">
									{row.changePct === null ? '—' : formatPct(row.changePct)}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div
			class="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-5 py-3 text-[10px] text-mist-600"
		>
			<span>
				Showing {formatQty(rows.length)} of {formatQty(data.items.length)} items · prices in gold nuggets
				per item · best prices can be in different regions.
			</span>
			<span>
				Source: <a href={WIKI_MARKET_PAGE} target="_blank" rel="noreferrer" class="text-mist-400 underline decoration-white/20 underline-offset-2 hover:text-mist-200">wiki.settlers-mc.org</a>
				· updates every {data.every}s
			</span>
		</div>
	{/if}
</section>
