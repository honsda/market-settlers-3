<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		CATEGORIES,
		getItem,
		type ItemMarket,
		type Offer
	} from '../market';
	import { formatPct, formatPrice, formatQty } from '../format';
	import { openComposer } from '../client/composer.svelte';
	import { cancelMyOffer } from '../client/offers';
	import ItemIcon from './ItemIcon.svelte';
	import Icon from './Icon.svelte';
	import LivePill from './LivePill.svelte';
	import OfferRow from './OfferRow.svelte';
	import Sparkline from './Sparkline.svelte';

	let {
		items,
		offers,
		initialItem = null
	}: { items: ItemMarket[]; offers: Offer[]; initialItem?: string | null } = $props();

	let chosen = $state<string | null>(null);
	const selectedId = $derived(chosen ?? initialItem);

	const activeItems = $derived(items.filter((entry) => entry.bidCount + entry.askCount > 0));
	const selected = $derived(
		activeItems.find((entry) => entry.itemId === selectedId) ??
			activeItems[0] ??
			items[0] ??
			null
	);
	const item = $derived(selected ? getItem(selected.itemId) : undefined);

	const buys = $derived(
		selected
			? offers
					.filter((offer) => offer.itemId === selected.itemId && offer.side === 'buy')
					.sort((a, b) => b.price - a.price || a.createdAt - b.createdAt)
			: []
	);
	const sells = $derived(
		selected
			? offers
					.filter((offer) => offer.itemId === selected.itemId && offer.side === 'sell')
					.sort((a, b) => a.price - b.price || a.createdAt - b.createdAt)
			: []
	);

	const buyQty = $derived(buys.reduce((sum, offer) => sum + offer.quantity, 0));
	const sellQty = $derived(sells.reduce((sum, offer) => sum + offer.quantity, 0));

	function locate(offer: Offer) {
		if (offer.x === null || offer.y === null || offer.z === null) return;
		void goto(`/map?x=${offer.x}&y=${offer.y}&z=${offer.z}&highlight=${offer.id}`);
	}
</script>

<section class="panel overflow-hidden">
	<div class="panel-header flex-wrap">
		<div class="flex items-center gap-3">
			<span
				class="flex h-9 w-9 items-center justify-center rounded-xl border border-bid/20 bg-bid/10 text-bid"
			>
				<Icon name="market" size={17} />
			</span>
			<div>
				<h2 class="text-sm font-semibold tracking-tight text-mist-100">Order book</h2>
				<p class="text-[11px] text-mist-500">Best price first · per-unit pricing</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<LivePill compact />
			<button type="button" class="btn-primary btn-sm" onclick={() => openComposer({ itemId: selected?.itemId })}>
				<Icon name="plus" size={14} /> Post
			</button>
		</div>
	</div>

	{#if selected && item}
		<div class="border-b border-white/[0.06] px-4 py-3.5">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
				<label class="relative flex-1">
					<span class="sr-only">Choose an item</span>
					<select class="select py-2 pl-10 text-xs font-semibold" bind:value={chosen}>
						{#each activeItems as entry (entry.itemId)}
							{@const option = getItem(entry.itemId)}
							{#if option}
								<option value={entry.itemId}>{option.name} — {entry.bidCount + entry.askCount} offers</option>
							{/if}
						{/each}
					</select>
					<span class="pointer-events-none absolute left-3 top-2.5">
						<ItemIcon item={item} size={18} />
					</span>
				</label>

				<a
					href="/market?item={selected.itemId}"
					class="hidden shrink-0 items-center gap-1 text-[11px] font-medium text-mist-500 transition hover:text-bid sm:flex"
				>
					Full market <Icon name="arrowUpRight" size={12} />
				</a>
			</div>

			<div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
				<div>
					<p class="text-[9px] font-semibold uppercase tracking-wider text-mist-600">Best bid</p>
					<p class="num text-sm font-semibold text-bid">
						{formatPrice(selected.bestBid)}
						<span class="text-[9px] font-normal text-mist-600">×{formatQty(selected.bidQty)}</span>
					</p>
				</div>
				<div>
					<p class="text-[9px] font-semibold uppercase tracking-wider text-mist-600">Best ask</p>
					<p class="num text-sm font-semibold text-ask">
						{formatPrice(selected.bestAsk)}
						<span class="text-[9px] font-normal text-mist-600">×{formatQty(selected.askQty)}</span>
					</p>
				</div>
				<div>
					<p class="text-[9px] font-semibold uppercase tracking-wider text-mist-600">Spread</p>
					<p class="num text-sm font-semibold text-mist-200">
						{selected.spread === null ? '—' : formatPrice(selected.spread)}
						{#if selected.spreadPct !== null}
							<span class="text-[9px] font-normal text-mist-500">{formatPct(selected.spreadPct, false)}</span>
						{/if}
					</p>
				</div>
				<div class="flex items-end justify-between gap-2">
					<div>
						<p class="text-[9px] font-semibold uppercase tracking-wider text-mist-600">24h</p>
						<p
							class="num text-sm font-semibold {selected.changePct === null
								? 'text-mist-500'
								: selected.changePct >= 0
									? 'text-bid'
									: 'text-danger'}"
						>
							{formatPct(selected.changePct)}
						</p>
					</div>
					<div class="hidden w-20 sm:block">
						<Sparkline values={selected.history.map((point) => point.mid)} height={24} fill={false} />
					</div>
				</div>
			</div>
		</div>

		<div class="grid sm:grid-cols-2">
			<div class="border-b border-white/[0.06] sm:border-b-0 sm:border-r">
				<div class="flex items-center justify-between px-4 pb-1.5 pt-3">
					<span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-bid">
						<Icon name="trendDown" size={12} /> Buy orders
					</span>
					<span class="num text-[10px] text-mist-600">{buys.length} · {formatQty(buyQty)} items</span>
				</div>
				<div class="max-h-[330px] space-y-0.5 overflow-y-auto p-2 pt-0">
					{#each buys as offer, index (offer.id)}
						<OfferRow {offer} rank={index + 1} best={index === 0} onCancel={cancelMyOffer} onLocate={locate} />
					{:else}
						<div class="flex flex-col items-center gap-2 py-8 text-center">
							<p class="text-[11px] text-mist-500">No buy orders for {item.name} yet.</p>
							<button
								type="button"
								class="text-[11px] font-semibold text-bid hover:text-emerald-300"
								onclick={() => openComposer({ side: 'buy', itemId: selected?.itemId })}
							>
								Place the first bid
							</button>
						</div>
					{/each}
				</div>
			</div>

			<div>
				<div class="flex items-center justify-between px-4 pb-1.5 pt-3">
					<span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ask">
						<Icon name="trendUp" size={12} /> Sell offers
					</span>
					<span class="num text-[10px] text-mist-600">{sells.length} · {formatQty(sellQty)} items</span>
				</div>
				<div class="max-h-[330px] space-y-0.5 overflow-y-auto p-2 pt-0">
					{#each sells as offer, index (offer.id)}
						<OfferRow {offer} rank={index + 1} best={index === 0} onCancel={cancelMyOffer} onLocate={locate} />
					{:else}
						<div class="flex flex-col items-center gap-2 py-8 text-center">
							<p class="text-[11px] text-mist-500">No one is selling {item.name} yet.</p>
							<button
								type="button"
								class="text-[11px] font-semibold text-ask hover:text-amber-300"
								onclick={() => openComposer({ side: 'sell', itemId: selected?.itemId })}
							>
								List yours first
							</button>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div
			class="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] bg-ink-950/30 px-4 py-2.5 text-[10px] text-mist-600"
		>
			<span>{CATEGORIES.find((entry) => entry.id === item.category)?.label} · {offers.length} open offers market-wide</span>
			<span class="flex items-center gap-1.5 text-mist-500">
				<Icon name="mapPin" size={11} /> click the pin to meet a trader
			</span>
		</div>
	{:else}
		<div class="flex flex-col items-center gap-3 px-6 py-14 text-center">
			<span class="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-mist-500">
				<Icon name="market" size={22} />
			</span>
			<div>
				<p class="text-sm font-semibold text-mist-200">The board is empty</p>
				<p class="mt-1 text-xs text-mist-500">Post the first buy or sell offer and start the market.</p>
			</div>
			<button type="button" class="btn-primary" onclick={() => openComposer()}>
				<Icon name="plus" size={15} /> Post an offer
			</button>
		</div>
	{/if}
</section>
