import { browser } from '$app/env';

/**
 * One shared live connection. The server watches the SQLite revision counter,
 * so offers created by the Discord bot show up here too.
 */
export const live = $state({
	revision: 0,
	connected: false,
	lastEvent: 0
});

let started = false;

export function startLive(): void {
	if (!browser || started) return;
	started = true;

	const source = new EventSource('/api/stream');

	source.addEventListener('open', () => {
		live.connected = true;
	});

	source.addEventListener('hello', (event) => {
		live.connected = true;
		apply(event);
	});

	source.addEventListener('market', (event) => {
		live.connected = true;
		apply(event);
	});

	source.addEventListener('error', () => {
		live.connected = false;
	});

	source.addEventListener('ping', () => {
		live.connected = true;
	});
}

function apply(event: MessageEvent): void {
	try {
		const data = JSON.parse(event.data) as { revision?: number };
		if (typeof data.revision === 'number' && data.revision !== live.revision) {
			live.revision = data.revision;
		}
		live.lastEvent = Date.now();
	} catch {
		// Ignore malformed frames; the EventSource will keep streaming.
	}
}

/** Nudge every mounted page to refresh after a local mutation. */
export function bumpLive(): void {
	live.revision += 1;
	live.lastEvent = Date.now();
}
