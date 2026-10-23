<script lang="ts">
	import type { Offer } from '../market';
	import { formatQty, formatPrice, timeAgo } from '../format';
	import { myOfferTokens } from '../client/profile.svelte';
	import Icon from './Icon.svelte';

	let {
		offer,
		rank,
		best = false,
		onCancel,
		onLocate
	}: {
		offer: Offer;
		rank: number;
		best?: boolean;
		onCancel?: (offer: Offer) => void;
		onLocate?: (offer: Offer) => void;
	} = $props();

	const owned = $derived(Boolean(myOfferTokens[offer.id]));
	const hasCoords = $derived(offer.x !== null && offer.y !== null && offer.z !== null);
	const total = $derived(offer.price * offer.quantity);
</script>

<div
	class="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition
		{best
		? offer.side === 'buy'
			? 'bg-bid/[0.055] hover:bg-bid/[0.08]'
			: 'bg-ask/[0.055] hover:bg-ask/[0.08]'
		: 'hover:bg-white/[0.035]'}"
	title={`${formatQty(offer.quantity)} × ${formatPrice(offer.price)} = ${formatPrice(total)} coins${offer.note ? ` — ${offer.note}` : ''}`}
>
	<span class="num w-3 shrink-0 text-[10px] text-mist-600">{rank}</span>

	<div class="min-w-0 flex-1">
		<div class="flex items-baseline justify-between gap-2">
			<span class="num text-[13px] font-semibold text-mist-100">{formatPrice(offer.price)}</span>
			<span class="num text-[10px] text-mist-500">{formatQty(offer.quantity)}×</span>
		</div>
		<div class="mt-0.5 flex items-center gap-1.5 text-[10px] text-mist-500">
			<span class="max-w-[92px] truncate font-medium text-mist-400">{offer.ign}</span>
			{#if offer.guild}
				<span class="truncate">· {offer.guild}</span>
			{/if}
			<span class="ml-auto shrink-0">{timeAgo(offer.createdAt)}</span>
		</div>
	</div>

	<div class="flex shrink-0 items-center gap-0.5">
		{#if hasCoords && onLocate}
			<button
				type="button"
				class="rounded-md p-1 text-mist-500 transition hover:bg-white/10 hover:text-bid"
				onclick={() => onLocate(offer)}
				aria-label="Show {offer.ign} on the map"
				title="Show on map"
			>
				<Icon name="mapPin" size={13} />
			</button>
		{/if}
		{#if owned && onCancel}
			<button
				type="button"
				class="rounded-md p-1 text-mist-600 transition hover:bg-danger/15 hover:text-danger"
				onclick={() => onCancel(offer)}
				aria-label="Cancel your offer"
				title="Cancel your offer"
			>
				<Icon name="x" size={13} />
			</button>
		{/if}
		{#if offer.contact}
			<span class="cursor-help text-mist-600" title={`Contact: ${offer.contact}`}>
				<Icon name="send" size={12} />
			</span>
		{/if}
	</div>
</div>
