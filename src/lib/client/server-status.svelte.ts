import { browser } from '$app/env';
import type { ServerStatus } from '../market';
import { getJSON } from './api';

export const serverStatus = $state<{
	data: ServerStatus | null;
	loading: boolean;
}>({ data: null, loading: true });

let started = false;

export async function loadServerStatus(): Promise<void> {
	try {
		serverStatus.data = await getJSON<ServerStatus>('/api/server');
	} catch {
		// Keep the last known status; the map may simply be restarting.
	} finally {
		serverStatus.loading = false;
	}
}

export function startServerPolling(): void {
	if (!browser || started) return;
	started = true;
	void loadServerStatus();
	setInterval(() => void loadServerStatus(), 60_000);
}
