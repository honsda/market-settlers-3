let timer: NodeJS.Timeout | null = null;

/**
 * Where the bot should ping itself. Render provides `RENDER_EXTERNAL_URL` for
 * every service; `KEEPALIVE_URL` is a manual override for other hosts.
 */
export function keepAliveTarget(): string | null {
	const base = (process.env.RENDER_EXTERNAL_URL ?? process.env.KEEPALIVE_URL ?? '').trim();
	if (!base) return null;
	return `${base.replace(/\/+$/, '')}/health`;
}

export async function pingKeepAlive(url: string): Promise<void> {
	try {
		// The cache-busting query keeps proxies and Render's edge from serving a
		// cached response without waking the instance.
		const response = await fetch(`${url}?self=${Date.now()}`);
		if (!response.ok) {
			console.warn(`[bot] Self keep-alive returned ${response.status}.`);
		}
	} catch (error) {
		console.warn(
			'[bot] Self keep-alive failed:',
			error instanceof Error ? error.message : error
		);
	}
}

/**
 * Render puts a free web service to sleep after 15 minutes without inbound
 * traffic. Pinging the service's own public URL counts as inbound traffic, so
 * a 10-minute timer keeps the gateway connected without any external pinger.
 *
 * This only prevents a sleep: once the instance is asleep nothing inside it
 * runs, so it cannot wake itself up. Use an external ping as a safety net if
 * the service is ever stopped or restarted for longer than the timer.
 */
export function startSelfKeepAlive(): void {
	const url = keepAliveTarget();
	if (!url || timer) return;

	const minutes = Math.max(1, Number(process.env.SELF_KEEPALIVE_MINUTES ?? 10) || 10);
	timer = setInterval(() => void pingKeepAlive(url), minutes * 60_000);
	timer.unref?.();
	console.log(`[bot] Self keep-alive: ${url} every ${minutes} min.`);
}

export function stopSelfKeepAlive(): void {
	if (!timer) return;
	clearInterval(timer);
	timer = null;
}
