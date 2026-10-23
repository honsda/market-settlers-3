<script lang="ts">
	import { browser } from '$app/env';
	import { page } from '$app/state';
	import { getJSON } from '../../lib/client/api';
	import { live } from '../../lib/client/live.svelte';
	import { serverStatus } from '../../lib/client/server-status.svelte';
	import { toast } from '../../lib/client/toast.svelte';
	import { formatPrice, formatQty } from '../../lib/format';
	import {
		SITE,
		getItem,
		mapUrl,
		type MarketResponse,
		type Offer
	} from '../../lib/market';
	import MapFrame from '../../lib/components/MapFrame.svelte';
	import ItemIcon from '../../lib/components/ItemIcon.svelte';
	import Icon from '../../lib/components/Icon.svelte';

	const params = page.url.searchParams;
	const initialCoords = {
		x: numberOrNull(params.get('x')),
		y: numberOrNull(params.get('y')),
		z: numberOrNull(params.get('z'))
	};

	function numberOrNull(value: string | null): number | null {
		if (value === null || value.trim() === '') return null;
		const parsed = Number(value);
		return Number.isFinite(parsed) ? Math.round(parsed) : null;
	}

	let data = $state<MarketResponse | null>(null);
	let loading = $state(true);
	let targetX = $state<number | null>(initialCoords.x);
	let targetY = $state<number | null>(initialCoords.y);
	let targetZ = $state<number | null>(initialCoords.z);
	let mapId = $state(params.get('map') ?? SITE.defaultMap);
	let zoom = $state(Number(params.get('zoom') ?? 2));
	let highlightId = $state<string | null>(params.get('highlight'));
	let seq = 0;

	async function load() {
		const current = ++seq;
		try {
			const next = await getJSON<MarketResponse>('/api/market');
			if (current !== seq) return;
			data = next;
		} catch {
			// Keep whatever is on screen; the map still works without offers.
		} finally {
			if (current === seq) loading = false;
		}
	}

	$effect(() => {
		live.revision;
		void load();
	});

	const mapSrc = $derived(
		mapUrl({ x: targetX, y: targetY, z: targetZ, map: mapId, zoom }, { panel: false })
	);
	const hasTarget = $derived(targetX !== null && targetY !== null && targetZ !== null);
	const selectedOffer = $derived(
		highlightId ? (data?.offers.find((offer) => offer.id === highlightId) ?? null) : null
	);
	const tradeOffers = $derived(
		(data?.offers ?? [])
			.filter((offer) => offer.x !== null && offer.y !== null && offer.z !== null)
			.slice(0, 12)
	);
	const players = $derived(serverStatus.data?.players ?? []);
	const selectedItem = $derived(selectedOffer ? getItem(selectedOffer.itemId) : undefined);

	function writeUrl() {
		if (!browser) return;
		const next = new URLSearchParams();
		if (targetX !== null && targetY !== null && targetZ !== null) {
			next.set('x', String(targetX));
			next.set('y', String(targetY));
			next.set('z', String(targetZ));
		}
		if (mapId !== SITE.defaultMap) next.set('map', mapId);
		if (zoom !== 2) next.set('zoom', String(zoom));
		if (highlightId) next.set('highlight', highlightId);
		const query = next.toString();
		window.history.replaceState(window.history.state, '', `/map${query ? `?${query}` : ''}`);
	}

	function setTarget(x: number, y: number, z: number, highlight: string | null = null) {
		targetX = Math.round(x);
		targetY = Math.round(y);
		targetZ = Math.round(z);
		highlightId = highlight;
		writeUrl();
	}

	function selectOffer(offer: Offer) {
		if (offer.x === null || offer.y === null || offer.z === null) return;
		setTarget(offer.x, offer.y, offer.z, offer.id);
	}

	function selectPlayer(name: string, x: number, y: number, z: number) {
		setTarget(x, y, z, null);
		toast(`Centered on ${name}`, 'info', 2200);
	}

	function setMap(next: string) {
		mapId = next;
		writeUrl();
	}

	function changeZoom(delta: number) {
		zoom = Math.min(5, Math.max(0, zoom + delta));
		writeUrl();
	}

	function clearTarget() {
		targetX = null;
		targetY = null;
		targetZ = null;
		highlightId = null;
		writeUrl();
	}

	async function copyCoords() {
		if (!hasTarget) return;
		const text = `${targetX} ${targetY} ${targetZ}`;
		try {
			await navigator.clipboard.writeText(text);
			toast('Coordinates copied');
		} catch {
			toast(`Coordinates: ${text}`, 'info');
		}
	}

	const healthTone = (health: number) =>
		health > 15 ? 'bg-bid' : health > 8 ? 'bg-ask' : 'bg-danger';
</script>

<svelte:head>
	<title>World map · Settlers Market</title>
	<meta name="description" content="The live Settlers III map for Caeldun, with trader coordinates and online players." />
</svelte:head>

<div class="space-y-5">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="eyebrow flex items-center gap-2">
				<span class="h-1.5 w-1.5 rounded-full {serverStatus.data?.online ? 'bg-bid pulse-dot' : 'bg-mist-500'}"></span>
				{SITE.world} · live world map
			</p>
			<h1 class="mt-1.5 text-2xl font-bold tracking-tight text-mist-100 sm:text-[30px]">World map</h1>
			<p class="mt-1 max-w-lg text-sm text-mist-400">
				The server's Dynmap, streamed live. Jump to a trader's coordinates or find someone online.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<span class="chip-neutral">
				<span class="h-1.5 w-1.5 rounded-full {serverStatus.data?.online ? 'bg-bid' : 'bg-mist-500'}"></span>
				{serverStatus.data?.online ? `${serverStatus.data.playerCount} online` : 'map offline'}
			</span>
			<a href={mapUrl({ map: mapId, zoom }, { panel: true })} target="_blank" rel="noreferrer" class="btn-ghost">
				<Icon name="external" size={14} /> Full map
			</a>
			<a href={mapUrl({ map: mapId, zoom }, { panel: true })} target="_blank" rel="noreferrer" class="btn-primary">
				<Icon name="external" size={14} /> Open full Dynmap
			</a>
		</div>
	</header>

	<div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
		<div class="space-y-3">
			<MapFrame
				src={mapSrc}
				heightClass="h-[58vh] min-h-[420px] xl:h-[calc(100vh-210px)]"
				title="Settlers III — Caeldun live map"
			>
				{#snippet overlay()}
					<div class="absolute left-3 top-3 flex max-w-[calc(100%-5rem)] flex-col gap-2">
						{#if selectedOffer && selectedItem}
							<div class="rounded-xl border border-white/10 bg-ink-950/85 px-3 py-2.5 shadow-xl backdrop-blur-md">
								<div class="flex items-start gap-2.5">
									<ItemIcon item={selectedItem} size={32} glow />
									<div class="min-w-0">
										<p class="flex items-center gap-1.5 text-[11px] font-semibold text-mist-100">
											{selectedItem.name}
											<span class={selectedOffer.side === 'buy' ? 'chip-bid' : 'chip-ask'}>
												{selectedOffer.side === 'buy' ? 'BUY' : 'SELL'}
											</span>
										</p>
										<p class="num mt-0.5 text-[10px] text-mist-400">
											{formatPrice(selectedOffer.price)} coins · {formatQty(selectedOffer.quantity)} units
										</p>
										<p class="mt-0.5 truncate text-[10px] text-mist-500">
											{selectedOffer.ign}{selectedOffer.guild ? ` · ${selectedOffer.guild}` : ''} · meeting point
										</p>
									</div>
								</div>
							</div>
						{:else if hasTarget}
							<div class="flex items-center gap-2 rounded-full border border-white/10 bg-ink-950/85 px-3 py-1.5 text-[10px] font-medium text-mist-300 backdrop-blur-md">
								<Icon name="mapPin" size={12} class="text-bid" />
								<span class="num">{targetX} / {targetY} / {targetZ}</span>
								<button type="button" class="text-mist-500 hover:text-danger" onclick={clearTarget} aria-label="Clear target">
									<Icon name="x" size={11} />
								</button>
							</div>
						{/if}
					</div>
				{/snippet}
			</MapFrame>

			<div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-ink-950/40 px-3 py-2">
				<div class="flex items-center gap-1.5">
					<span class="text-[10px] font-semibold uppercase tracking-wider text-mist-600">Layer</span>
					{#each SITE.maps as option (option.id)}
						<button
							type="button"
							class="rounded-lg px-2.5 py-1 text-[10px] font-semibold transition
								{mapId === option.id
								? 'bg-white/[0.08] text-mist-100'
								: 'text-mist-500 hover:bg-white/[0.04] hover:text-mist-300'}"
							onclick={() => setMap(option.id)}>{option.label}</button
						>
					{/each}
				</div>

				<div class="flex items-center gap-1.5">
					<span class="text-[10px] font-semibold uppercase tracking-wider text-mist-600">Zoom</span>
					<button type="button" class="btn-icon h-7 w-7 rounded-lg" onclick={() => changeZoom(-1)} aria-label="Zoom out">
						−
					</button>
					<span class="num w-4 text-center text-[10px] text-mist-300">{zoom}</span>
					<button type="button" class="btn-icon h-7 w-7 rounded-lg" onclick={() => changeZoom(1)} aria-label="Zoom in">
						+
					</button>
					<span class="ml-2 hidden text-[10px] text-mist-600 sm:inline">Chunk view is sharpest at 2–4</span>
				</div>
			</div>
		</div>

		<aside class="space-y-4 xl:sticky xl:top-6 xl:self-start">
			<section class="panel overflow-hidden">
				<div class="panel-header">
					<div class="flex items-center gap-2.5">
						<span class="flex h-8 w-8 items-center justify-center rounded-lg border border-bid/20 bg-bid/10 text-bid">
							<Icon name="compass" size={15} />
						</span>
						<div>
							<h2 class="text-xs font-semibold text-mist-100">Coordinates</h2>
							<p class="text-[10px] text-mist-500">{hasTarget ? 'Meeting point selected' : 'Pick a trader or player'}</p>
						</div>
					</div>
				</div>

				{#if hasTarget}
					<div class="space-y-2.5 p-3.5">
						<div class="grid grid-cols-3 gap-2">
							{#each [{ label: 'X', value: targetX }, { label: 'Y', value: targetY }, { label: 'Z', value: targetZ }] as coord (coord.label)}
								<div class="rounded-lg border border-white/[0.07] bg-ink-950/60 px-2 py-1.5 text-center">
									<p class="text-[9px] font-semibold uppercase tracking-wider text-mist-600">{coord.label}</p>
									<p class="num text-xs text-mist-200">{coord.value}</p>
								</div>
							{/each}
						</div>
						<div class="flex gap-2">
							<button type="button" class="btn-ghost btn-sm flex-1" onclick={copyCoords}>
								<Icon name="copy" size={12} /> Copy
							</button>
							<a
								href={mapUrl({ x: targetX, y: targetY, z: targetZ, map: mapId, zoom }, { panel: true })}
								target="_blank"
								rel="noreferrer"
								class="btn-ghost btn-sm flex-1"
							>
								<Icon name="external" size={12} /> Full map
							</a>
						</div>
						<p class="text-[10px] leading-relaxed text-mist-500">
							These are the in-game coordinates. Press <span class="kbd">F3</span> in Minecraft to compare your own
							position.
						</p>
					</div>
				{:else}
					<div class="px-4 py-6 text-center">
						<Icon name="mapPin" size={20} class="mx-auto text-mist-600" />
						<p class="mt-2 text-[11px] leading-relaxed text-mist-500">
							Select a trader below or tap a player to center the map on them.
						</p>
					</div>
				{/if}
			</section>

			<section class="panel overflow-hidden">
				<div class="panel-header py-3">
					<div class="flex items-center gap-2">
						<span class="h-1.5 w-1.5 rounded-full {serverStatus.data?.online ? 'bg-bid pulse-dot' : 'bg-mist-500'}"></span>
						<h2 class="text-xs font-semibold text-mist-100">Players online</h2>
					</div>
					<span class="num text-[10px] text-mist-500">{players.length}</span>
				</div>
				<div class="max-h-[240px] overflow-y-auto p-1.5">
					{#each players as player (player.name)}
						<div class="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.035]">
							<span class="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[10px] font-bold uppercase text-mist-300">
								{player.name.slice(0, 1)}
							</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-[11px] font-medium text-mist-200">{player.name}</p>
								<div class="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
									<div class="h-full {healthTone(player.health)}" style:width="{(player.health / 20) * 100}%"></div>
								</div>
							</div>
							<span class="num hidden text-[9px] text-mist-600 sm:block">{player.health}❤</span>
							<button
								type="button"
								class="rounded-md p-1 text-mist-600 transition hover:bg-white/10 hover:text-bid"
								onclick={() => selectPlayer(player.name, player.x, player.y, player.z)}
								title={`Locate ${player.name}`}
								aria-label={`Locate ${player.name} on the map`}
							>
								<Icon name="mapPin" size={12} />
							</button>
						</div>
					{:else}
						<p class="px-3 py-5 text-center text-[11px] text-mist-500">
							No players detected. The map updates every few seconds.
						</p>
					{/each}
				</div>
			</section>

			<section class="panel overflow-hidden">
				<div class="panel-header py-3">
					<div class="flex items-center gap-2">
						<Icon name="tag" size={13} class="text-ask" />
						<h2 class="text-xs font-semibold text-mist-100">Traders on the map</h2>
					</div>
					<span class="num text-[10px] text-mist-500">{tradeOffers.length}</span>
				</div>
				<div class="max-h-[300px] overflow-y-auto p-1.5">
					{#each tradeOffers as offer (offer.id)}
						{@const item = getItem(offer.itemId)}
						<button
							type="button"
							class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.035] {highlightId ===
							offer.id
								? 'bg-bid/[0.06]'
								: ''}"
							onclick={() => selectOffer(offer)}
						>
							{#if item}
								<ItemIcon item={item} size={24} />
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate text-[10px] font-medium text-mist-300">
									{item?.name ?? offer.itemId}
									<span class={offer.side === 'buy' ? 'text-bid' : 'text-ask'}>
										· {offer.side === 'buy' ? 'buy' : 'sell'} {formatPrice(offer.price)}
									</span>
								</p>
								<p class="num truncate text-[9px] text-mist-600">
									{offer.x} / {offer.y} / {offer.z} · {offer.ign}
								</p>
							</div>
							<Icon name="chevronRight" size={11} class="shrink-0 text-mist-600" />
						</button>
					{:else}
						<p class="px-3 py-5 text-center text-[11px] leading-relaxed text-mist-500">
							No offers have coordinates yet. Add a meeting point when you post an offer and it will show
							up here.
						</p>
					{/each}
				</div>
			</section>
		</aside>
	</div>
</div>
