import type { Side } from '../market';

export const composer = $state<{
	open: boolean;
	side: Side;
	itemId: string | null;
}>({ open: false, side: 'buy', itemId: null });

export function openComposer(options: { side?: Side; itemId?: string | null } = {}): void {
	composer.side = options.side ?? 'buy';
	composer.itemId = options.itemId ?? null;
	composer.open = true;
}

export function closeComposer(): void {
	composer.open = false;
}
