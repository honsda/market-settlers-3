<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import Sidebar from '../lib/components/Sidebar.svelte';
	import MobileHeader from '../lib/components/MobileHeader.svelte';
	import OfferForm from '../lib/components/OfferForm.svelte';
	import ProfileModal from '../lib/components/ProfileModal.svelte';
	import ConfirmHost from '../lib/components/ConfirmHost.svelte';
	import Toaster from '../lib/components/Toaster.svelte';
	import { startLive } from '../lib/client/live.svelte';
	import { startServerPolling } from '../lib/client/server-status.svelte';
	import { loadProfile } from '../lib/client/profile.svelte';

	let { children } = $props();

	onMount(() => {
		loadProfile();
		startLive();
		startServerPolling();
	});
</script>

<svelte:head>
	<meta name="theme-color" content="#060a0f" />
</svelte:head>

<div class="min-h-screen lg:pl-[268px]">
	<Sidebar />
	<MobileHeader />

	<main class="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 sm:py-7">
		{@render children()}

		<footer
			class="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.055] pt-4 text-[10px] text-mist-600"
		>
			<p>
				<span class="font-semibold text-mist-500">Settlers Market</span> · a community trading board for
				Settlers III
			</p>
			<p class="flex items-center gap-2">
				<span>Prices are player-set</span>
				<span class="text-mist-700">·</span>
				<span>Trade at your own risk</span>
			</p>
		</footer>
	</main>
</div>

<OfferForm />
<ProfileModal />
<ConfirmHost />
<Toaster />
