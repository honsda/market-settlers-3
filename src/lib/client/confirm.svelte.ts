export interface ConfirmOptions {
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
}

export const confirmState = $state<{
	open: boolean;
	options: ConfirmOptions;
	resolve: ((value: boolean) => void) | null;
}>({
	open: false,
	options: { title: '', message: '' },
	resolve: null
});

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
	return new Promise((resolve) => {
		confirmState.options = options;
		confirmState.resolve = resolve;
		confirmState.open = true;
	});
}

export function resolveConfirm(value: boolean): void {
	confirmState.resolve?.(value);
	confirmState.resolve = null;
	confirmState.open = false;
}
