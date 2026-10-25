<script lang="ts">
	import { getJSON } from '../../lib/client/api';
	import { live } from '../../lib/client/live.svelte';
	import { openComposer } from '../../lib/client/composer.svelte';
	import { formatPrice, formatQty } from '../../lib/format';
	import { ITEMS, type MarketResponse } from '../../lib/market';
	import MarketTable from '../../lib/components/MarketTable.svelte';
	import WikiMarketPanel from '../../lib/components/WikiMarketPanel.svelte';
	import Icon from '../../lib/components/Icon.svelte';
	import LivePill from '../../lib/components/LivePill.svelte';

	let data = $state<MarketResponse | null>(null);
	let loading = $state(true);
	let error = $state('');
	let seq = 0;

	async function load() {
		const current = ++seq;
		try {
			const next = await getJSON<MarketResponse>('/api/market');
			if (current !== seq) return;
			data = next;
			error = '';
		} catch (err) {
			if (current !== seq) return;
			error = err instanceof Error ? err.message : 'Could not load markets.';
		} finally {
			if (current === seq) loading = false;
		}
	}

	$effect(() => {
		live.revision;
		void load();
	});
</script>

<svelte:head>
	<title>Market board · Settlers Market</title>
	<meta name="description" content="Every item market on Settlers III — best bids, asks, spreads and 24h moves." />
</svelte:head>

<div class="space-y-5">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="eyebrow">Price discovery</p>
			<h1 class="mt-1.5 text-2xl font-bold tracking-tight text-mist-100 sm:text-[30px]">Market board</h1>
			<p class="mt-1 max-w-lg text-sm text-mist-400">
				Compare every traded item. Expand a row to see who is buying and selling.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<LivePill />
			<button type="button" class="btn-primary" onclick={() => openComposer()}>
				<Icon name="plus" size={16} /> Post an offer
			</button>
		</div>
	</header>

	{#if loading && !data}
		<div class="space-y-4">
			<div class="grid gap-3 sm:grid-cols-3">
				{#each [0, 1, 2] as index (index)}
					<div class="skeleton h-20"></div>
				{/each}
			</div>
			<div class="skeleton h-[460px]"></div>
		</div>
	{:else if !data}
		<div class="panel flex flex-col items-center gap-3 px-6 py-16 text-center">
			<Icon name="wifiOff" size={22} class="text-danger" />
			<p class="text-sm font-semibold text-mist-200">Could not load the market board</p>
			<p class="text-xs text-mist-500">{error}</p>
			<button type="button" class="btn-primary" onclick={() => { loading = true; void load(); }}>
				<Icon name="refresh" size={14} /> Retry
			</button>
		</div>
	{:else}
		<div class="grid gap-3 sm:grid-cols-3">
			<div class="panel flex items-center justify-between gap-3 px-4 py-3.5">
				<div>
					<p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">Tracked catalogue</p>
					<p class="num mt-1 text-xl font-semibold text-mist-100">{ITEMS.length}</p>
				</div>
				<span class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-mist-400">
					<Icon name="layers" size={16} />
				</span>
			</div>
			<div class="panel flex items-center justify-between gap-3 px-4 py-3.5">
				<div>
					<p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">Open offers</p>
					<p class="num mt-1 text-xl font-semibold text-mist-100">
						{formatQty(data.summary.openBuys + data.summary.openSells)}
					</p>
				</div>
				<span class="flex h-9 w-9 items-center justify-center rounded-xl border border-bid/20 bg-bid/10 text-bid">
					<Icon name="activity" size={16} />
				</span>
			</div>
			<div class="panel flex items-center justify-between gap-3 px-4 py-3.5">
				<div>
					<p class="text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">Listed value</p>
					<p class="num mt-1 text-xl font-semibold text-mist-100">{formatPrice(data.summary.listedValue)}</p>
				</div>
				<span class="flex h-9 w-9 items-center justify-center rounded-xl border border-ask/20 bg-ask/10 text-ask">
					<Icon name="coins" size={16} />
				</span>
			</div>
		</div>

		<MarketTable items={data.items} offers={data.offers} />

		<p class="flex items-start gap-1.5 text-[10px] leading-relaxed text-mist-600">
			<Icon name="info" size={11} class="mt-0.5 shrink-0" />
			Bid = the highest price a buyer is paying. Ask = the lowest price a seller will accept. Spread is the gap
			between them; a tight spread means a liquid market.
		</p>
	{/if}

	<WikiMarketPanel />
</div>
