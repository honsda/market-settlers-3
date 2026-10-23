<script lang="ts">
	import { confirmState, resolveConfirm } from '../client/confirm.svelte';
	import Modal from './Modal.svelte';
	import Icon from './Icon.svelte';

	const options = $derived(confirmState.options);
</script>

<Modal
	open={confirmState.open}
	onclose={() => resolveConfirm(false)}
	title={options.title}
	subtitle={options.message}
	widthClass="max-w-md"
>
	<div class="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-ink-950/50 p-3.5">
		<span
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {options.danger
				? 'bg-danger/10 text-danger'
				: 'bg-bid/10 text-bid'}"
		>
			<Icon name={options.danger ? 'alert' : 'info'} size={17} />
		</span>
		<p class="text-xs leading-relaxed text-mist-400">
			{options.danger
				? 'This action cannot be undone. Make sure you really want to continue.'
				: 'Confirm to continue.'}
		</p>
	</div>

	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn-ghost" onclick={() => resolveConfirm(false)}>
				{options.cancelLabel ?? 'Never mind'}
			</button>
			<button
				type="button"
				class={options.danger ? 'btn-danger' : 'btn-primary'}
				onclick={() => resolveConfirm(true)}
			>
				{options.confirmLabel ?? 'Confirm'}
			</button>
		</div>
	{/snippet}
</Modal>
