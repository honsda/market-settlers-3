<script lang="ts">
	import { live } from '../client/live.svelte';
	import { openProfile, toggleMobileNav } from '../client/ui.svelte';
	import { profile } from '../client/profile.svelte';
	import Icon from './Icon.svelte';
</script>

<header
	class="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-ink-950/80 px-4 py-3 backdrop-blur-xl lg:hidden"
>
	<button type="button" class="btn-icon" onclick={() => toggleMobileNav(true)} aria-label="Open navigation">
		<Icon name="menu" size={18} />
	</button>

	<a href="/" class="flex items-center gap-2">
		<svg viewBox="0 0 24 24" class="h-6 w-6 text-bid" fill="currentColor" aria-hidden="true">
			<path d="M12 2 21 8.5 12 22 3 8.5 12 2Z" fill-opacity=".9" />
			<path d="M12 6 17 9.5 12 17 7 9.5 12 6Z" class="fill-ink-950" fill-opacity=".75" />
		</svg>
		<span class="text-sm font-bold tracking-tight text-mist-100">Settlers Market</span>
	</a>

	<div class="flex items-center gap-2">
		<span
			class="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-mist-400"
			title={live.connected ? 'Live market updates connected' : 'Reconnecting to live updates'}
		>
			<span class="h-1 w-1 rounded-full {live.connected ? 'bg-bid' : 'bg-ask'}" class:pulse-dot={live.connected}
			></span>
			{live.connected ? 'Live' : 'Offline'}
		</span>
		<button
			type="button"
			class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-xs font-bold uppercase text-mist-200"
			onclick={openProfile}
			aria-label="Edit player profile"
		>
			{profile.ign ? profile.ign.slice(0, 1) : '?'}
		</button>
	</div>
</header>
