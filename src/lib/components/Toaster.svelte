<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { toasts, dismissToast } from '../client/toast.svelte';
	import Icon from './Icon.svelte';
</script>

<div class="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4 sm:justify-end sm:pr-6">
	<div class="flex w-full max-w-sm flex-col gap-2">
		{#each toasts as item (item.id)}
			<div
				transition:fly={{ y: -12, duration: 180 }}
				class="toast animate-toast {item.kind === 'error'
					? 'border-danger/30 bg-ink-900/95 text-danger'
					: item.kind === 'info'
						? 'border-white/15 bg-ink-900/95 text-mist-100'
						: 'border-bid/30 bg-ink-900/95 text-bid'}"
			>
				<Icon
					name={item.kind === 'error' ? 'alert' : item.kind === 'info' ? 'info' : 'check'}
					size={17}
					class="shrink-0"
				/>
				<span class="flex-1 leading-snug">{item.message}</span>
				<button
					type="button"
					class="rounded-md p-1 text-mist-500 transition hover:bg-white/10 hover:text-mist-200"
					onclick={() => dismissToast(item.id)}
					aria-label="Dismiss"
				>
					<Icon name="x" size={14} />
				</button>
			</div>
		{/each}
	</div>
</div>
