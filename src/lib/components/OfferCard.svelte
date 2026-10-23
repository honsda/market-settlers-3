<script lang="ts">
	import { getItem, type Offer } from '../market';
	import { formatPrice, formatQty, timeAgo, coordsLabel } from '../format';
	import { myOfferTokens } from '../client/profile.svelte';
	import { cancelMyOffer } from '../client/offers';
	import { goto } from '$app/navigation';
	import ItemIcon from './ItemIcon.svelte';
	import Icon from './Icon.svelte';

	let { offer }: { offer: Offer } = $props();

	const item = $derived(getItem(offer.itemId));
	const owned = $derived(Boolean(myOfferTokens[offer.id]));
	const coords = $derived(coordsLabel(offer));

	function locate() {
		if (offer.x === null || offer.y === null || offer.z === null) return;
		void goto(`/map?x=${offer.x}&y=${offer.y}&z=${offer.z}&highlight=${offer.id}`);
	}
</script>

{#if item}
	<article
		class="group relative flex flex-col gap-3 rounded-xl border border-white/[0.065] bg-ink-950/35 p-3.5 transition hover:border-white/15 hover:bg-white/[0.025]"
	>
		<div class="flex items-start gap-3">
			<ItemIcon item={item} size={36} />
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<p class="truncate text-sm font-semibold text-mist-100">{item.name}</p>
					<span class={offer.side === 'buy' ? 'chip-bid' : 'chip-ask'}>
						{offer.side === 'buy' ? 'BUY' : 'SELL'}
					</span>
					{#if offer.status !== 'open'}
						<span class="chip-neutral ml-auto">{offer.status}</span>
					{/if}
				</div>
				<p class="mt-0.5 truncate text-[11px] text-mist-500">
					<span class="text-mist-300">{offer.ign}</span>
					{#if offer.guild} · {offer.guild}{/if}
					<span class="text-mist-600"> · {timeAgo(offer.createdAt)}</span>
				</p>
			</div>
		</div>

		<div class="flex items-end justify-between gap-3">
			<div>
				<p class="num text-lg font-semibold leading-none text-mist-100">
					{formatPrice(offer.price)}
					<span class="text-[10px] font-normal text-mist-500">coins / unit</span>
				</p>
				<p class="num mt-1 text-[10px] text-mist-500">
					{formatQty(offer.quantity)} units · total {formatPrice(offer.price * offer.quantity)}
				</p>
			</div>
			<div class="flex items-center gap-1">
				{#if coords}
					<button
						type="button"
						class="btn-icon h-7 w-7 rounded-lg border-white/[0.07] bg-transparent text-mist-500 hover:text-bid"
						onclick={locate}
						title={`Meet at ${coords}`}
						aria-label="Show meeting point on map"
					>
						<Icon name="mapPin" size={13} />
					</button>
				{/if}
				{#if owned && offer.status === 'open'}
					<button
						type="button"
						class="btn-icon h-7 w-7 rounded-lg border-white/[0.07] bg-transparent text-mist-500 hover:border-danger/30 hover:text-danger"
						onclick={() => cancelMyOffer(offer)}
						title="Cancel your offer"
						aria-label="Cancel your offer"
					>
						<Icon name="trash" size={13} />
					</button>
				{/if}
			</div>
		</div>

		{#if offer.note}
			<p class="line-clamp-2 rounded-lg bg-white/[0.025] px-2.5 py-2 text-[11px] leading-relaxed text-mist-400">
				{offer.note}
			</p>
		{/if}
	</article>
{/if}
