<script lang="ts">
	import { page } from '$app/state';
	import { live } from '../client/live.svelte';
	import { openProfile, toggleMobileNav, ui } from '../client/ui.svelte';
	import { serverStatus } from '../client/server-status.svelte';
	import { openComposer } from '../client/composer.svelte';
	import { profile } from '../client/profile.svelte';
	import Icon from './Icon.svelte';
	import { SITE } from '../market';

	const nav = [
		{ href: '/', label: 'Dashboard', icon: 'dashboard', exact: true },
		{ href: '/market', label: 'Market', icon: 'market' },
		{ href: '/map', label: 'World map', icon: 'map' },
		{ href: '/discord', label: 'Discord alerts', icon: 'discord' }
	];

	const pathname = $derived(page.url.pathname);
	const isActive = (href: string, exact = false) =>
		exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
</script>

{#snippet brand()}
	<a href="/" class="flex items-center gap-3" onclick={() => toggleMobileNav(false)}>
		<span
			class="relative flex h-10 w-10 items-center justify-center rounded-xl border border-bid/25 bg-gradient-to-br from-bid/25 to-bid-deep/10 shadow-[0_0_30px_-8px_rgba(52,211,153,0.5)]"
		>
			<svg viewBox="0 0 24 24" class="h-5 w-5 text-bid" fill="currentColor" aria-hidden="true">
				<path d="M12 2 21 8.5 12 22 3 8.5 12 2Z" fill-opacity=".9" />
				<path d="M12 6 17 9.5 12 17 7 9.5 12 6Z" class="fill-ink-950" fill-opacity=".75" />
			</svg>
		</span>
		<span class="leading-tight">
			<span class="block text-[15px] font-bold tracking-tight text-mist-100">Settlers Market</span>
			<span class="block text-[10px] font-semibold uppercase tracking-[0.18em] text-mist-500"
				>{SITE.server} · {SITE.world}</span
			>
		</span>
	</a>
{/snippet}

{#snippet newOfferButton()}
	<button
		type="button"
		class="btn-primary w-full justify-between"
		onclick={() => {
			toggleMobileNav(false);
			openComposer();
		}}
	>
		<span class="flex items-center gap-2"><Icon name="plus" size={16} /> Post an offer</span>
		<span class="text-[10px] font-bold uppercase tracking-wider text-ink-950/60">Trading</span>
	</button>
{/snippet}

{#snippet links()}
	<nav class="space-y-1">
		{#each nav as item (item.href)}
			{@const active = isActive(item.href, item.exact)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				onclick={() => toggleMobileNav(false)}
				class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition
					{active
					? 'bg-white/[0.065] text-mist-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
					: 'text-mist-400 hover:bg-white/[0.04] hover:text-mist-200'}"
			>
				<span class={active ? 'text-bid' : 'text-mist-500 transition group-hover:text-mist-300'}>
					<Icon name={item.icon} size={17} />
				</span>
				<span class="flex-1">{item.label}</span>
				{#if active}
					<span class="h-1.5 w-1.5 rounded-full bg-bid shadow-[0_0_10px_2px_rgba(52,211,153,0.5)]"
					></span>
				{/if}
			</a>
		{/each}
	</nav>
{/snippet}

{#snippet footer()}
	<div class="space-y-3">
		<a
			href="/map"
			onclick={() => toggleMobileNav(false)}
			class="block rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 transition hover:border-bid/25 hover:bg-bid/[0.04]"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="flex items-center gap-2 text-xs font-semibold text-mist-200">
					<span
						class="h-1.5 w-1.5 rounded-full {serverStatus.data?.online
							? 'bg-bid shadow-[0_0_8px_rgba(52,211,153,0.8)]'
							: 'bg-mist-500'}"
					></span>
					{SITE.world}
				</span>
				<Icon name="arrowUpRight" size={13} class="text-mist-500" />
			</div>
			<p class="mt-1.5 text-[11px] text-mist-500">
				{#if serverStatus.data?.online}
					<span class="font-mono text-mist-300">{serverStatus.data.playerCount}</span> players online
				{:else if serverStatus.loading}
					Connecting to the map…
				{:else}
					Map server unreachable
				{/if}
			</p>
		</a>

		<button
			type="button"
			class="group flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-ink-950/40 p-2.5 text-left transition hover:border-white/15"
			onclick={() => {
				toggleMobileNav(false);
				openProfile();
			}}
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-bold uppercase text-mist-200"
			>
				{#if profile.ign}
					{profile.ign.slice(0, 1)}
				{:else}
					<Icon name="user" size={16} class="text-mist-400" />
				{/if}
			</span>
			<span class="min-w-0 flex-1 leading-tight">
				<span class="block truncate text-xs font-semibold text-mist-200">
					{profile.ign || 'Set your IGN'}
				</span>
				<span class="block truncate text-[11px] text-mist-500">
					{profile.guild || 'Add your guild'}
				</span>
			</span>
			<Icon name="settings" size={15} class="text-mist-500 transition group-hover:text-mist-300" />
		</button>

		<div class="flex items-center justify-between px-1 text-[10px] font-medium text-mist-600">
			<span class="flex items-center gap-1.5">
				<span
					class="h-1 w-1 rounded-full {live.connected ? 'bg-bid' : 'bg-ask'}"
					class:pulse-dot={live.connected}
				></span>
				{live.connected ? 'Live sync' : 'Reconnecting'}
			</span>
			<a class="hover:text-mist-300" href="/discord">Bot status</a>
		</div>
	</div>
{/snippet}

<aside
	class="fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col justify-between border-r border-white/[0.06] bg-ink-950/70 px-4 py-5 backdrop-blur-xl lg:flex"
>
	<div class="space-y-6">
		<div class="px-1">{@render brand()}</div>
		<div class="px-1">{@render newOfferButton()}</div>
		<div class="space-y-2 px-1">
			<p class="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-mist-600">Trade</p>
			{@render links()}
		</div>
	</div>
	<div class="px-1">{@render footer()}</div>
</aside>

{#if ui.mobileNav}
	<div class="fixed inset-0 z-[60] lg:hidden">
		<button
			type="button"
			class="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
			aria-label="Close navigation"
			onclick={() => toggleMobileNav(false)}
		></button>
		<aside
			class="absolute inset-y-0 left-0 flex w-[82%] max-w-[300px] flex-col justify-between border-r border-white/10 bg-ink-900 px-4 py-5 shadow-2xl"
		>
			<div class="space-y-6">
				<div class="flex items-center justify-between px-1">
					{@render brand()}
					<button type="button" class="btn-icon" onclick={() => toggleMobileNav(false)} aria-label="Close">
						<Icon name="x" size={16} />
					</button>
				</div>
				<div class="px-1">{@render newOfferButton()}</div>
				<div class="px-1">{@render links()}</div>
			</div>
			<div class="px-1">{@render footer()}</div>
		</aside>
	</div>
{/if}
