<script lang="ts">
	import {
		CATEGORIES,
		ITEMS,
		SIDES,
		getItem,
		searchItems,
		mapUrl,
		type CategoryId,
		type ItemMarket,
		type MarketResponse,
		type Side
	} from '../market';
	import { cn, formatPrice } from '../format';
	import { composer } from '../client/composer.svelte';
	import { profile, rememberOffer, saveProfile } from '../client/profile.svelte';
	import { bumpLive } from '../client/live.svelte';
	import { toast } from '../client/toast.svelte';
	import { getJSON, sendJSON } from '../client/api';
	import type { Offer } from '../market';
	import Modal from './Modal.svelte';
	import Icon from './Icon.svelte';
	import ItemIcon from './ItemIcon.svelte';

	let side = $state<Side>('buy');
	let itemId = $state('diamond');
	let search = $state('');
	let category = $state<CategoryId | 'all'>('all');
	let quantity = $state('64');
	let price = $state('');
	let ign = $state('');
	let guild = $state('');
	let contact = $state('');
	let coordX = $state('');
	let coordY = $state('');
	let coordZ = $state('');
	let note = $state('');
	let submitting = $state(false);
	let error = $state('');
	let guilds = $state<string[]>([]);
	let marketItems = $state<ItemMarket[]>([]);
	let wasOpen = false;

	$effect(() => {
		if (composer.open && !wasOpen) {
			wasOpen = true;
			side = composer.side;
			itemId = composer.itemId ?? itemId;
			ign = profile.ign;
			guild = profile.guild;
			contact = profile.contact;
			error = '';
			search = '';
			category = 'all';
			void getJSON<{ guilds: string[] }>('/api/guilds')
				.then((data) => (guilds = data.guilds))
				.catch(() => undefined);
			void getJSON<MarketResponse>('/api/market')
				.then((data) => (marketItems = data.items))
				.catch(() => undefined);
		}
		if (!composer.open) wasOpen = false;
	});

	const selected = $derived(getItem(itemId) ?? ITEMS[0]);
	const filtered = $derived(searchItems(search, category));
	const sideMeta = $derived(SIDES.find((entry) => entry.id === side) ?? SIDES[0]);
	const reference = $derived(marketItems.find((entry) => entry.itemId === itemId));
	const numericQty = $derived(Number.parseInt(quantity, 10));
	const numericPrice = $derived(Number.parseFloat(price.replace(',', '.')));
	const total = $derived(
		Number.isFinite(numericQty) && Number.isFinite(numericPrice) && numericQty > 0 && numericPrice > 0
			? numericQty * numericPrice
			: 0
	);

	const quickPrice = $derived(
		side === 'buy' ? (reference?.bestBid ?? reference?.mid) : (reference?.bestAsk ?? reference?.mid)
	);

	function resetCoordinates() {
		coordX = '';
		coordY = '';
		coordZ = '';
	}

	function validate(): string {
		if (!/^[A-Za-z0-9_]{3,16}$/.test(ign.trim())) {
			return 'Add your Minecraft IGN (3–16 letters, numbers or underscores).';
		}
		if (!Number.isInteger(numericQty) || numericQty < 1) return 'Quantity must be a whole number above zero.';
		if (!Number.isFinite(numericPrice) || numericPrice <= 0) return 'Set a price above zero.';
		const hasCoords = [coordX, coordY, coordZ].some((value) => value.trim() !== '');
		if (hasCoords) {
			const x = Number.parseInt(coordX, 10);
			const y = Number.parseInt(coordY, 10);
			const z = Number.parseInt(coordZ, 10);
			if (![x, y, z].every(Number.isInteger)) return 'Location needs whole numbers for X, Y and Z.';
			if (y < -64 || y > 320) return 'Y must be between -64 and 320.';
		}
		return '';
	}

	async function submit() {
		if (submitting) return;
		const problem = validate();
		if (problem) {
			error = problem;
			return;
		}
		submitting = true;
		error = '';
		const hasCoords = [coordX, coordY, coordZ].some((value) => value.trim() !== '');
		try {
			const result = await sendJSON<{ offer: Offer; editToken: string }>('/api/offers', 'POST', {
				side,
				itemId,
				quantity: numericQty,
				price: numericPrice,
				ign: ign.trim(),
				guild: guild.trim(),
				contact: contact.trim(),
				note: note.trim(),
				x: hasCoords ? Number.parseInt(coordX, 10) : null,
				y: hasCoords ? Number.parseInt(coordY, 10) : null,
				z: hasCoords ? Number.parseInt(coordZ, 10) : null
			});
			rememberOffer(result.offer.id, result.editToken);
			if (ign.trim() !== profile.ign || guild.trim() !== profile.guild || contact.trim() !== profile.contact) {
				saveProfile({ ign: ign.trim(), guild: guild.trim(), contact: contact.trim() });
			}
			bumpLive();
			toast(`Your ${side === 'buy' ? 'buy order' : 'sell offer'} for ${selected.name} is live`);
			composer.open = false;
			price = '';
			note = '';
			resetCoordinates();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not post the offer.';
		} finally {
			submitting = false;
		}
	}
</script>

<Modal
	open={composer.open}
	onclose={() => (composer.open = false)}
	title="Post to the market"
	subtitle="Offers are public and appear instantly on the board and in Discord alerts."
	widthClass="max-w-3xl"
>
	<form
		id="offer-form"
		class="space-y-5"
		onsubmit={(event) => {
			event.preventDefault();
			void submit();
		}}
	>
		<div class="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.07] bg-ink-950/40 p-1.5">
			{#each SIDES as option (option.id)}
				<button
					type="button"
					onclick={() => (side = option.id)}
					aria-pressed={side === option.id}
					class={cn(
						'flex flex-col items-start gap-0.5 rounded-xl px-3.5 py-2.5 text-left transition',
						side === option.id
							? option.id === 'buy'
								? 'bg-bid/10 text-bid shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] ring-1 ring-bid/30'
								: 'bg-ask/10 text-ask shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] ring-1 ring-ask/30'
							: 'text-mist-400 hover:bg-white/[0.04] hover:text-mist-200'
					)}
				>
					<span class="flex items-center gap-1.5 text-sm font-semibold">
						<Icon name={option.id === 'buy' ? 'trendDown' : 'trendUp'} size={15} />
						{option.label}
					</span>
					<span class="text-[11px] font-normal text-mist-500">{option.blurb}</span>
				</button>
			{/each}
		</div>

		<div>
			<div class="label">
				<span>Item</span>
				<span class="font-mono text-[10px] text-mist-600">{ITEMS.length} tracked</span>
			</div>

			<div class="rounded-2xl border border-white/[0.07] bg-ink-950/40 p-3">
				<div class="mb-3 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5">
					<ItemIcon item={selected} size={40} glow />
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold text-mist-100">{selected.name}</p>
						<p class="text-[11px] text-mist-500">
							{CATEGORIES.find((entry) => entry.id === selected.category)?.label}
							{#if reference?.mid}
								· market mid <span class="font-mono text-mist-300">{formatPrice(reference.mid)}</span>
							{/if}
						</p>
					</div>
					{#if reference?.bestBid || reference?.bestAsk}
						<div class="hidden text-right text-[10px] leading-tight text-mist-500 sm:block">
							<div>
								bid <span class="font-mono text-bid">{formatPrice(reference?.bestBid)}</span>
							</div>
							<div>
								ask <span class="font-mono text-ask">{formatPrice(reference?.bestAsk)}</span>
							</div>
						</div>
					{/if}
				</div>

				<div class="relative mb-2">
					<Icon name="search" size={15} class="pointer-events-none absolute left-3 top-2.5 text-mist-500" />
					<input
						class="input py-2 pl-9 text-xs"
						placeholder="Search the catalogue…"
						bind:value={search}
						aria-label="Search items"
					/>
				</div>

				<div class="mb-2 flex flex-wrap gap-1.5">
					<button
						type="button"
						class={cn(
							'rounded-full border px-2.5 py-1 text-[10px] font-semibold transition',
							category === 'all'
								? 'border-bid/35 bg-bid/10 text-bid'
								: 'border-white/10 bg-white/[0.02] text-mist-400 hover:text-mist-200'
						)}
						onclick={() => (category = 'all')}>All</button
					>
					{#each CATEGORIES as option (option.id)}
						<button
							type="button"
							class={cn(
								'rounded-full border px-2.5 py-1 text-[10px] font-semibold transition',
								category === option.id
									? 'border-bid/35 bg-bid/10 text-bid'
									: 'border-white/10 bg-white/[0.02] text-mist-400 hover:text-mist-200'
							)}
							onclick={() => (category = option.id)}>{option.label}</button
						>
					{/each}
				</div>

				<div class="grid max-h-52 grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-6 lg:grid-cols-8">
					{#each filtered as item (item.id)}
						<button
							type="button"
							onclick={() => (itemId = item.id)}
							aria-pressed={itemId === item.id}
							title={item.name}
							class={cn(
								'flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition',
								itemId === item.id
									? 'border-bid/50 bg-bid/10'
									: 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]'
							)}
						>
							<ItemIcon item={item} size={26} />
							<span class="line-clamp-2 text-center text-[9px] leading-tight text-mist-400">{item.name}</span>
						</button>
					{:else}
						<p class="col-span-full py-4 text-center text-xs text-mist-500">No items match “{search}”.</p>
					{/each}
				</div>
			</div>
		</div>

		<div class="grid gap-3 sm:grid-cols-3">
			<div>
				<label class="label" for="offer-quantity">Quantity</label>
				<input
					id="offer-quantity"
					class="input font-mono"
					inputmode="numeric"
					bind:value={quantity}
					placeholder="64"
				/>
			</div>
			<div>
				<label class="label" for="offer-price">
					<span>Price per unit</span>
					{#if quickPrice}
						<button
							type="button"
							class="text-[10px] font-medium text-bid hover:text-emerald-300"
							onclick={() => (price = quickPrice.toFixed(2))}
						>
							use {side === 'buy' ? 'best bid' : 'best ask'} {formatPrice(quickPrice)}
						</button>
					{/if}
				</label>
				<div class="relative">
					<input
						id="offer-price"
						class="input pr-14 font-mono"
						inputmode="decimal"
						bind:value={price}
						placeholder="0.00"
					/>
					<span class="pointer-events-none absolute right-3 top-2.5 text-[11px] font-medium text-mist-500"
						>coins</span
					>
				</div>
			</div>
			<div class="flex flex-col justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2">
				<p class="text-[10px] font-semibold uppercase tracking-wider text-mist-500">Order total</p>
				<p class="num mt-0.5 text-lg font-semibold text-mist-100">
					{formatPrice(total)} <span class="text-[11px] font-normal text-mist-500">coins</span>
				</p>
			</div>
		</div>

		<div class="grid gap-3 sm:grid-cols-3">
			<div>
				<label class="label" for="offer-ign">
					<span>Your IGN <span class="text-danger">*</span></span>
				</label>
				<input
					id="offer-ign"
					class="input"
					bind:value={ign}
					maxlength="16"
					placeholder="Minecraft username"
					autocomplete="off"
					spellcheck="false"
				/>
			</div>
			<div>
				<label class="label" for="offer-guild"><span>Guild</span></label>
				<input
					id="offer-guild"
					class="input"
					bind:value={guild}
					list="offer-guilds"
					maxlength="32"
					placeholder="Optional"
					autocomplete="off"
				/>
				<datalist id="offer-guilds">
					{#each guilds as suggestion (suggestion)}
						<option value={suggestion}></option>
					{/each}
				</datalist>
			</div>
			<div>
				<label class="label" for="offer-contact"><span>Contact</span></label>
				<input
					id="offer-contact"
					class="input"
					bind:value={contact}
					maxlength="64"
					placeholder="Discord (optional)"
					autocomplete="off"
				/>
			</div>
		</div>

		<div>
			<div class="label">
				<span>Meeting point</span>
				<button type="button" class="flex items-center gap-1 text-[10px] text-mist-500 hover:text-mist-300" onclick={resetCoordinates}>
					<Icon name="refresh" size={11} /> clear
				</button>
			</div>
			<div class="grid grid-cols-3 gap-2">
				<input class="input font-mono text-xs" bind:value={coordX} placeholder="X" inputmode="numeric" aria-label="X coordinate" />
				<input class="input font-mono text-xs" bind:value={coordY} placeholder="Y" inputmode="numeric" aria-label="Y coordinate" />
				<input class="input font-mono text-xs" bind:value={coordZ} placeholder="Z" inputmode="numeric" aria-label="Z coordinate" />
			</div>
			<p class="mt-1.5 flex items-center gap-1.5 text-[11px] text-mist-500">
				<Icon name="mapPin" size={12} />
				Optional — buyers can jump straight to you on the
				<a class="link" href={mapUrl({}, { panel: true })} target="_blank" rel="noreferrer">live map</a>.
			</p>
		</div>

		<div>
			<label class="label" for="offer-note">
				<span>Note</span>
				<span class="font-mono text-[10px] font-normal text-mist-600">{note.length}/160</span>
			</label>
			<textarea
				id="offer-note"
				class="textarea"
				bind:value={note}
				maxlength="160"
				placeholder="e.g. Online after 18:00 UTC, can meet near spawn"
			></textarea>
		</div>

		{#if error}
			<div class="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-xs text-danger">
				<Icon name="alert" size={15} class="mt-0.5 shrink-0" />
				<p>{error}</p>
			</div>
		{/if}

		<p class="text-[11px] leading-relaxed text-mist-500">
			{sideMeta.blurb} Posting is free. Your IGN and guild are published with the offer; your edit token stays
			in this browser so you can cancel it later.
		</p>
	</form>

	{#snippet footer()}
		<div class="flex items-center justify-between gap-3">
			<div class="hidden leading-tight sm:block">
				<p class="text-[10px] font-semibold uppercase tracking-wider text-mist-600">
					{side === 'buy' ? 'You pay' : 'You receive'}
				</p>
				<p class="num text-sm font-semibold text-mist-200">
					{formatPrice(total)} <span class="text-[10px] font-normal text-mist-500">coins</span>
				</p>
			</div>
			<div class="flex w-full gap-2 sm:w-auto">
				<button type="button" class="btn-ghost flex-1 sm:flex-none" onclick={() => (composer.open = false)}>
					Cancel
				</button>
				<button type="submit" form="offer-form" class="btn-primary flex-1 sm:flex-none" disabled={submitting}>
					{#if submitting}
						<Icon name="refresh" size={15} class="animate-spin" /> Posting…
					{:else}
						<Icon name={side === 'buy' ? 'trendDown' : 'trendUp'} size={15} />
						Publish {side === 'buy' ? 'buy order' : 'sell offer'}
					{/if}
				</button>
			</div>
		</div>
	{/snippet}
</Modal>
