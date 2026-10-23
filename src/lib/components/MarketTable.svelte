<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		CATEGORIES,
		ITEMS,
		getItem,
		type CategoryId,
		type ItemMarket,
		type Offer
	} from '../market';
	import { formatPct, formatPrice, formatQty, cn } from '../format';
	import { openComposer } from '../client/composer.svelte';
	import { cancelMyOffer } from '../client/offers';
	import ItemIcon from './ItemIcon.svelte';
	import Icon from './Icon.svelte';
	import OfferRow from './OfferRow.svelte';
	import Sparkline from './Sparkline.svelte';

	let { items, offers }: { items: ItemMarket[]; offers: Offer[] } = $props();

	let query = $state('');
	let category = $state<CategoryId | 'all'>('all');
	let sort = $state<'volume' | 'change' | 'spread' | 'name'>('volume');
	let expanded = $state<string | null>(page.url.searchParams.get('item'));

	const rows = $derived.by(() => {
		const search = query.trim().toLowerCase();
		const filtered = items.filter((entry) => {
			const item = getItem(entry.itemId);
			if (!item) return false;
			if (category !== 'all' && item.category !== category) return false;
			if (!search) return true;
			return (
				item.name.toLowerCase().includes(search) ||
				item.id.includes(search) ||
				(item.aliases ?? '').toLowerCase().includes(search)
			);
		});

		return filtered.sort((a, b) => {
			if (sort === 'name') {
				return (getItem(a.itemId)?.name ?? '').localeCompare(getItem(b.itemId)?.name ?? '');
			}
			if (sort === 'change') {
				return Math.abs(b.changePct ?? -1) - Math.abs(a.changePct ?? -1);
			}
			if (sort === 'spread') {
				return (a.spreadPct ?? Number.MAX_SAFE_INTEGER) - (b.spreadPct ?? Number.MAX_SAFE_INTEGER);
			}
			const aValue = (a.bestBid ?? 0) * a.bidQtyTotal + (a.bestAsk ?? 0) * a.askQtyTotal;
			const bValue = (b.bestBid ?? 0) * b.bidQtyTotal + (b.bestAsk ?? 0) * b.askQtyTotal;
			return bValue - aValue;
		});
	});

	const countWithOffers = $derived(items.filter((entry) => entry.bidCount + entry.askCount > 0).length);

	function offersFor(itemId: string, side: 'buy' | 'sell'): Offer[] {
		return offers
			.filter((offer) => offer.itemId === itemId && offer.side === side)
			.sort((a, b) => (side === 'buy' ? b.price - a.price : a.price - b.price));
	}

	function toggle(itemId: string) {
		expanded = expanded === itemId ? null : itemId;
	}

	function locate(offer: Offer) {
		if (offer.x === null || offer.y === null || offer.z === null) return;
		void goto(`/map?x=${offer.x}&y=${offer.y}&z=${offer.z}&highlight=${offer.id}`);
	}
</script>

<section class="panel overflow-hidden">
	<div class="panel-header flex-wrap gap-3">
		<div class="flex items-center gap-3">
			<span class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-mist-200">
				<Icon name="layers" size={17} />
			</span>
			<div>
				<h2 class="text-sm font-semibold tracking-tight text-mist-100">All markets</h2>
				<p class="text-[11px] text-mist-500">
					{countWithOffers} of {ITEMS.length} items have live offers
				</p>
			</div>
		</div>

		<div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
			<label class="relative min-w-[180px] flex-1">
				<Icon name="search" size={14} class="pointer-events-none absolute left-3 top-2.5 text-mist-500" />
				<input
					class="input py-2 pl-9 text-xs"
					placeholder="Search markets…"
					bind:value={query}
					aria-label="Search markets"
				/>
			</label>
			<select class="select w-auto py-2 text-xs" bind:value={sort} aria-label="Sort markets">
				<option value="volume">Sort: activity</option>
				<option value="change">Sort: 24h move</option>
				<option value="spread">Sort: tightest spread</option>
				<option value="name">Sort: name</option>
			</select>
		</div>
	</div>

	<div class="flex gap-1.5 overflow-x-auto border-b border-white/[0.06] px-4 py-2.5">
		<button
			type="button"
			class="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition
				{category === 'all'
				? 'border-bid/35 bg-bid/10 text-bid'
				: 'border-white/10 bg-white/[0.02] text-mist-400 hover:text-mist-200'}"
			onclick={() => (category = 'all')}>All items</button
		>
		{#each CATEGORIES as option (option.id)}
			<button
				type="button"
				class="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition
					{category === option.id
					? 'border-bid/35 bg-bid/10 text-bid'
					: 'border-white/10 bg-white/[0.02] text-mist-400 hover:text-mist-200'}"
				onclick={() => (category = option.id)}>{option.label}</button
			>
		{/each}
	</div>

	<div class="overflow-x-auto">
		<table class="w-full min-w-[700px] border-collapse text-left">
			<thead>
				<tr class="text-[9px] font-semibold uppercase tracking-[0.12em] text-mist-600">
					<th class="py-2.5 pl-4 pr-3 font-semibold">Item</th>
					<th class="px-3 py-2.5 text-right font-semibold">Best bid</th>
					<th class="px-3 py-2.5 text-right font-semibold">Best ask</th>
					<th class="hidden px-3 py-2.5 text-right font-semibold md:table-cell">Spread</th>
					<th class="px-3 py-2.5 text-right font-semibold">24h</th>
					<th class="hidden px-3 py-2.5 font-semibold lg:table-cell">7d trend</th>
					<th class="px-3 py-2.5 text-right font-semibold">Offers</th>
					<th class="w-8 pr-3"></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as entry (entry.itemId)}
					{@const item = getItem(entry.itemId)}
					{#if item}
						{@const isOpen = expanded === entry.itemId}
						<tr
							class={cn(
								'cursor-pointer border-t border-white/[0.045] transition hover:bg-white/[0.025]',
								isOpen && 'bg-white/[0.02]'
							)}
							onclick={() => toggle(entry.itemId)}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									toggle(entry.itemId);
								}
							}}
							tabindex="0"
							aria-expanded={isOpen}
						>
							<td class="py-2.5 pl-4 pr-3">
								<div class="flex items-center gap-2.5">
									<ItemIcon item={item} size={30} />
									<div class="min-w-0">
										<p class="truncate text-xs font-semibold text-mist-200">{item.name}</p>
										<p class="text-[10px] text-mist-600">
											{CATEGORIES.find((categoryEntry) => categoryEntry.id === item.category)?.label}
										</p>
									</div>
								</div>
							</td>
							<td class="px-3 py-2.5 text-right">
								<p class="num text-xs font-semibold text-bid">{formatPrice(entry.bestBid)}</p>
								<p class="num text-[10px] text-mist-600">{formatQty(entry.bidQtyTotal)} units</p>
							</td>
							<td class="px-3 py-2.5 text-right">
								<p class="num text-xs font-semibold text-ask">{formatPrice(entry.bestAsk)}</p>
								<p class="num text-[10px] text-mist-600">{formatQty(entry.askQtyTotal)} units</p>
							</td>
							<td class="hidden px-3 py-2.5 text-right md:table-cell">
								<p class="num text-xs text-mist-300">
									{entry.spread === null ? '—' : formatPrice(entry.spread)}
								</p>
								<p class="num text-[10px] text-mist-600">{formatPct(entry.spreadPct, false)}</p>
							</td>
							<td class="px-3 py-2.5 text-right">
								<span
									class="num inline-flex items-center gap-0.5 text-[11px] font-semibold
										{entry.changePct === null
										? 'text-mist-600'
										: entry.changePct >= 0
											? 'text-bid'
											: 'text-danger'}"
								>
									{#if entry.changePct !== null}
										<Icon name={entry.changePct >= 0 ? 'trendUp' : 'trendDown'} size={11} />
									{/if}
									{formatPct(entry.changePct)}
								</span>
							</td>
							<td class="hidden px-3 py-2.5 lg:table-cell">
								<div class="w-20">
									<Sparkline values={entry.history.slice(-40).map((point) => point.mid)} height={22} />
								</div>
							</td>
							<td class="px-3 py-2.5 text-right">
								<span class="num text-[11px] text-mist-400">{entry.bidCount + entry.askCount}</span>
							</td>
							<td class="pr-3 text-mist-600">
								<span class="inline-block transition {isOpen ? 'rotate-180 text-bid' : ''}">
									<Icon name="chevronDown" size={13} />
								</span>
							</td>
						</tr>

						{#if isOpen}
							<tr class="border-t border-white/[0.04]">
								<td colspan="8" class="bg-ink-950/50 px-4 py-4">
									<div class="grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
										<div>
											<div class="mb-1.5 flex items-center justify-between">
												<p class="text-[10px] font-bold uppercase tracking-wider text-bid">Buy orders</p>
												<button
													type="button"
													class="text-[10px] font-semibold text-bid hover:text-emerald-300"
													onclick={() => openComposer({ side: 'buy', itemId: entry.itemId })}
												>
													+ Buy
												</button>
											</div>
											<div class="space-y-0.5">
												{#each offersFor(entry.itemId, 'buy').slice(0, 4) as offer, index (offer.id)}
													<OfferRow {offer} rank={index + 1} best={index === 0} onCancel={cancelMyOffer} onLocate={locate} />
												{:else}
													<p class="py-4 text-[11px] text-mist-500">No bids yet.</p>
												{/each}
											</div>
										</div>

										<div>
											<div class="mb-1.5 flex items-center justify-between">
												<p class="text-[10px] font-bold uppercase tracking-wider text-ask">Sell offers</p>
												<button
													type="button"
													class="text-[10px] font-semibold text-ask hover:text-amber-300"
													onclick={() => openComposer({ side: 'sell', itemId: entry.itemId })}
												>
													+ Sell
												</button>
											</div>
											<div class="space-y-0.5">
												{#each offersFor(entry.itemId, 'sell').slice(0, 4) as offer, index (offer.id)}
													<OfferRow {offer} rank={index + 1} best={index === 0} onCancel={cancelMyOffer} onLocate={locate} />
												{:else}
													<p class="py-4 text-[11px] text-mist-500">Nothing listed.</p>
												{/each}
											</div>
										</div>

										<div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
											<p class="text-[10px] font-semibold uppercase tracking-wider text-mist-500">Price tape</p>
											<div class="mt-2">
												<Sparkline values={entry.history.map((point) => point.mid)} height={54} />
											</div>
											<div class="mt-2 grid grid-cols-2 gap-1 text-[10px] text-mist-500">
												<span>Mid</span>
												<span class="num text-right text-mist-200">{formatPrice(entry.mid)}</span>
												<span>Snapshots</span>
												<span class="num text-right text-mist-300">{entry.history.length}</span>
											</div>
											<button
												type="button"
												class="btn-ghost btn-sm mt-3 w-full"
												onclick={() => openComposer({ itemId: entry.itemId })}
											>
												<Icon name="plus" size={12} /> Post for {item.name}
											</button>
										</div>
									</div>
								</td>
							</tr>
						{/if}
					{/if}
				{:else}
					<tr class="border-t border-white/[0.045]">
						<td colspan="8">
							<div class="flex flex-col items-center gap-2 py-12 text-center">
								<Icon name="search" size={20} class="text-mist-600" />
								<p class="text-xs text-mist-400">No markets match this filter.</p>
								<button
									type="button"
									class="text-[11px] font-semibold text-bid hover:text-emerald-300"
									onclick={() => {
										query = '';
										category = 'all';
									}}
								>
									Clear filters
								</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
