<script lang="ts">
	import { page } from '$app/state';
	import { getJSON } from '../lib/client/api';
	import { live } from '../lib/client/live.svelte';
	import { openComposer } from '../lib/client/composer.svelte';
	import { openProfile } from '../lib/client/ui.svelte';
	import { profile } from '../lib/client/profile.svelte';
	import { serverStatus } from '../lib/client/server-status.svelte';
	import { formatPct, formatPrice, formatQty } from '../lib/format';
	import { SITE, mapUrl, type MarketResponse } from '../lib/market';
	import StatCard from '../lib/components/StatCard.svelte';
	import OrderBook from '../lib/components/OrderBook.svelte';
	import OfferCard from '../lib/components/OfferCard.svelte';
	import MoversList from '../lib/components/MoversList.svelte';
	import LivePill from '../lib/components/LivePill.svelte';
	import AlertItem from '../lib/components/AlertItem.svelte';
	import Icon from '../lib/components/Icon.svelte';

	let data = $state<MarketResponse | null>(null);
	let loading = $state(true);
	let error = $state('');
	let requestSeq = 0;

	const openRecent = $derived((data?.recent ?? []).filter((offer) => offer.status === 'open').slice(0, 6));
	const latestAlert = $derived(data?.alerts?.[0] ?? null);
	const initialItem = $derived(page.url.searchParams.get('item'));

	async function load() {
		const seq = ++requestSeq;
		try {
			const next = await getJSON<MarketResponse>('/api/market');
			if (seq !== requestSeq) return;
			data = next;
			error = '';
		} catch (err) {
			if (seq !== requestSeq) return;
			error = err instanceof Error ? err.message : 'Could not load the market.';
		} finally {
			if (seq === requestSeq) loading = false;
		}
	}

	$effect(() => {
		live.revision;
		void load();
	});
</script>

<svelte:head>
	<title>Market hall · Settlers Market</title>
	<meta
		name="description"
		content="Live buy and sell orders for Settlers III — post offers with your IGN and guild, meet traders on the world map."
	/>
</svelte:head>

{#if loading && !data}
	<div class="space-y-5">
		<div class="flex items-end justify-between gap-4">
			<div class="space-y-2">
				<div class="skeleton h-3 w-32"></div>
				<div class="skeleton h-9 w-64"></div>
				<div class="skeleton h-3 w-80"></div>
			</div>
			<div class="skeleton h-10 w-36"></div>
		</div>
		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{#each Array(4) as _, index (index)}
				<div class="skeleton h-[124px]"></div>
			{/each}
		</div>
		<div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
			<div class="skeleton h-[520px]"></div>
			<div class="space-y-5">
				<div class="skeleton h-[280px]"></div>
				<div class="skeleton h-[220px]"></div>
			</div>
		</div>
	</div>
{:else if !data}
	<div class="panel flex flex-col items-center gap-3 px-6 py-16 text-center">
		<span class="flex h-12 w-12 items-center justify-center rounded-2xl border border-danger/25 bg-danger/10 text-danger">
			<Icon name="wifiOff" size={22} />
		</span>
		<div>
			<p class="text-sm font-semibold text-mist-200">The market hall is unreachable</p>
			<p class="mt-1 max-w-sm text-xs text-mist-500">{error || 'Check the server logs and try again.'}</p>
		</div>
		<button
			type="button"
			class="btn-primary"
			onclick={() => {
				loading = true;
				void load();
			}}
		>
			<Icon name="refresh" size={15} /> Try again
		</button>
	</div>
{:else}
	<div class="space-y-5">
		<header class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p class="eyebrow flex items-center gap-2">
					<span class="h-1.5 w-1.5 rounded-full bg-bid pulse-dot"></span>
					{SITE.server} · {SITE.world} exchange
				</p>
				<h1 class="mt-1.5 text-2xl font-bold tracking-tight text-mist-100 sm:text-[32px]">Market hall</h1>
				<p class="mt-1 max-w-lg text-sm text-mist-400">
					Player-set bids and asks for the world of {SITE.world}. Meet on the live map, trade in game.
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<LivePill />
				<button type="button" class="btn-ghost" onclick={openProfile}>
					<Icon name="user" size={15} />
					{profile.ign || 'Set your IGN'}
				</button>
				<button type="button" class="btn-primary" onclick={() => openComposer()}>
					<Icon name="plus" size={16} /> Post an offer
				</button>
			</div>
		</header>

		{#if data.hasDemo}
			<div class="flex items-start gap-2.5 rounded-xl border border-ask/20 bg-ask/[0.055] px-3.5 py-2.5 text-[11px] text-ask">
				<Icon name="info" size={14} class="mt-0.5 shrink-0" />
				<p>
					Demo offers and price history are loaded so you can explore the board.
					<span class="text-ask/70">Run <code class="rounded bg-black/25 px-1 py-0.5 font-mono">npm run db:reset</code> to start clean.</span>
				</p>
			</div>
		{/if}

		<section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			<StatCard
				label="Open buy orders"
				value={formatQty(data.summary.openBuys)}
				hint={`${formatQty(data.summary.buyQty)} units wanted`}
				icon="trendDown"
				tone="bid"
			/>
			<StatCard
				label="Open sell offers"
				value={formatQty(data.summary.openSells)}
				hint={`${formatQty(data.summary.sellQty)} units for sale`}
				icon="trendUp"
				tone="ask"
			/>
			<StatCard
				label="Traders · 7 days"
				value={formatQty(data.summary.traders)}
				hint={`${data.summary.guilds} guilds active`}
				icon="users"
			/>
			<StatCard
				label="Listed market value"
				value={formatPrice(data.summary.listedValue)}
				hint={`${data.summary.offers24h} new offers in 24h`}
				icon="coins"
			>
				<span class="num flex items-center gap-1 text-[10px] font-semibold text-mist-500">
					<Icon name="coins" size={11} /> coins
				</span>
			</StatCard>
		</section>

		<div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
			<div class="min-w-0 space-y-5">
				<OrderBook items={data.items} offers={data.offers} initialItem={initialItem} />

				<section class="panel overflow-hidden">
					<div class="panel-header">
						<div class="flex items-center gap-3">
							<span class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-mist-300">
								<Icon name="sparkles" size={16} />
							</span>
							<div>
								<h2 class="text-sm font-semibold tracking-tight text-mist-100">Fresh on the board</h2>
								<p class="text-[11px] text-mist-500">The newest offers from all traders</p>
							</div>
						</div>
						<a href="/market" class="text-[11px] font-medium text-mist-500 transition hover:text-bid">
							Browse markets
						</a>
					</div>

					{#if openRecent.length}
						<div class="grid gap-3 p-4 sm:grid-cols-2">
							{#each openRecent as offer (offer.id)}
								<OfferCard {offer} />
							{/each}
						</div>
					{:else}
						<div class="flex flex-col items-center gap-3 px-6 py-10 text-center">
							<Icon name="package" size={22} class="text-mist-600" />
							<p class="text-xs text-mist-400">Nothing has been listed yet. Be the first trader.</p>
							<button type="button" class="btn-primary btn-sm" onclick={() => openComposer()}>
								<Icon name="plus" size={13} /> Post the first offer
							</button>
						</div>
					{/if}
				</section>
			</div>

			<aside class="space-y-5 xl:sticky xl:top-6 xl:self-start">
				<MoversList items={data.items} />

				<section class="panel overflow-hidden">
					<div class="panel-header">
						<div class="flex items-center gap-3">
							<span class="flex h-9 w-9 items-center justify-center rounded-xl border border-ask/20 bg-ask/10 text-ask">
								<Icon name="bell" size={16} />
							</span>
							<div>
								<h2 class="text-sm font-semibold tracking-tight text-mist-100">Latest signal</h2>
								<p class="text-[11px] text-mist-500">Auto-alerts at {formatPct(data.thresholdPct, false)} moves</p>
							</div>
						</div>
						<a href="/discord" class="text-[11px] font-medium text-mist-500 transition hover:text-bid">Discord</a>
					</div>

					{#if latestAlert}
						<AlertItem alert={latestAlert} compact />
					{:else}
						<div class="flex flex-col items-center gap-2 px-5 py-7 text-center">
							<Icon name="activity" size={18} class="text-mist-600" />
							<p class="text-[11px] text-mist-500">
								No significant moves yet. Alerts fire automatically when a best price moves more than
								{formatPct(data.thresholdPct, false)}.
							</p>
						</div>
					{/if}

					<a
						href="/discord"
						class="flex items-center justify-between border-t border-white/[0.06] bg-ink-950/30 px-4 py-2.5 text-[10px] font-medium text-mist-500 transition hover:text-mist-200"
					>
						<span class="flex items-center gap-1.5"><Icon name="discord" size={12} /> Bot posts to Discord</span>
						<Icon name="arrowRight" size={12} />
					</a>
				</section>

				<section
					class="panel relative overflow-hidden p-4"
				>
					<div
						class="pointer-events-none absolute inset-0 opacity-[0.35]"
						style:background-image="radial-gradient(circle at 20% 30%, rgba(52,211,153,.2) 0, transparent 35%), radial-gradient(circle at 75% 65%, rgba(251,191,36,.15) 0, transparent 40%), linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)"
						style:background-size="auto, auto, 22px 22px, 22px 22px"
					></div>
					<div class="relative">
						<div class="flex items-center justify-between">
							<span class="chip-neutral"><Icon name="globe" size={11} /> Live world</span>
							<span class="num text-[10px] text-mist-500">
								{serverStatus.data?.online ? `${serverStatus.data.playerCount} online` : 'offline'}
							</span>
						</div>
						<h2 class="mt-3 text-sm font-semibold text-mist-100">{SITE.world}</h2>
						<p class="mt-0.5 text-[11px] leading-relaxed text-mist-500">
							Explore the server map, check coordinates and meet your trading partner.
						</p>

						{#if serverStatus.data?.players.length}
							<div class="mt-3 flex flex-wrap gap-1">
								{#each serverStatus.data.players.slice(0, 3) as player (player.name)}
									<span class="rounded-md border border-white/[0.07] bg-ink-950/50 px-1.5 py-0.5 text-[9px] text-mist-400">
										{player.name}
									</span>
								{/each}
								{#if serverStatus.data.players.length > 3}
									<span class="rounded-md border border-white/[0.07] bg-ink-950/50 px-1.5 py-0.5 text-[9px] text-mist-500">
										+{serverStatus.data.players.length - 3}
									</span>
								{/if}
							</div>
						{/if}

						<div class="mt-4 flex gap-2">
							<a href="/map" class="btn-primary btn-sm flex-1">
								<Icon name="map" size={13} /> Open map
							</a>
							<a
								href={mapUrl({}, { panel: true })}
								target="_blank"
								rel="noreferrer"
								class="btn-ghost btn-sm"
								title="Open the full Dynmap"
							>
								<Icon name="external" size={13} />
							</a>
						</div>
					</div>
				</section>
			</aside>
		</div>
	</div>
{/if}
