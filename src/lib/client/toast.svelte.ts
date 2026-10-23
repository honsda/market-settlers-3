import { browser } from '$app/env';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
	id: number;
	message: string;
	kind: ToastKind;
}

export const toasts = $state<Toast[]>([]);
let nextId = 1;

export function toast(message: string, kind: ToastKind = 'success', duration = 4200): void {
	const id = nextId++;
	toasts.push({ id, message, kind });
	if (browser) {
		setTimeout(() => dismissToast(id), duration);
	}
}

export function dismissToast(id: number): void {
	const index = toasts.findIndex((item) => item.id === id);
	if (index !== -1) toasts.splice(index, 1);
}
