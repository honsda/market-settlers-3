<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Icon from './Icon.svelte';

	let {
		open,
		onclose,
		title,
		subtitle = '',
		children,
		footer,
		widthClass = 'max-w-2xl'
	}: {
		open: boolean;
		onclose: () => void;
		title: string;
		subtitle?: string;
		children: Snippet;
		footer?: Snippet;
		widthClass?: string;
	} = $props();

	function onKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			event.preventDefault();
			onclose();
		}
	}

	$effect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div class="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
		<div
			class="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
			transition:fade={{ duration: 150 }}
			role="presentation"
			onclick={onclose}
		></div>
		<div
			class="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-ink-900 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] sm:rounded-2xl {widthClass}"
			transition:fly={{ y: 24, duration: 200 }}
			role="dialog"
			aria-modal="true"
			aria-label={title}
		>
			<div class="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4 sm:px-6">
				<div>
					<h2 class="text-lg font-semibold tracking-tight text-mist-100">{title}</h2>
					{#if subtitle}
						<p class="mt-0.5 text-sm text-mist-400">{subtitle}</p>
					{/if}
				</div>
				<button type="button" class="btn-icon shrink-0" onclick={onclose} aria-label="Close dialog">
					<Icon name="x" size={17} />
				</button>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
				{@render children()}
			</div>
			{#if footer}
				<div class="border-t border-white/[0.07] bg-ink-950/40 px-5 py-4 sm:px-6">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
