import { SITE, type ServerStatus } from '../market';

interface DynmapPlayer {
	name?: string;
	account?: string;
	x?: number;
	y?: number;
	z?: number;
	health?: number;
}

interface DynmapWorld {
	currentcount?: number;
	players?: DynmapPlayer[];
}

const globalScope = globalThis as typeof globalThis & {
	__ms3DynmapCache?: { at: number; value: ServerStatus };
};

const CACHE_MS = 20_000;

export async function getServerStatus(): Promise<ServerStatus> {
	const cached = globalScope.__ms3DynmapCache;
	if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

	const fallback: ServerStatus = {
		online: false,
		playerCount: 0,
		players: [],
		fetchedAt: Date.now()
	};

	try {
		const endpoint = `${SITE.mapUrl}up/world/${encodeURIComponent(SITE.mapWorld)}/0`;
		const response = await fetch(endpoint, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(5000)
		});
		if (!response.ok) throw new Error(`Dynmap responded ${response.status}`);
		const data = (await response.json()) as DynmapWorld;
		const players = (data.players ?? []).map((player) => ({
			name: player.account || (player.name ?? '').replace(/^\[[^\]]+\]\s*/, ''),
			x: Math.round(player.x ?? 0),
			y: Math.round(player.y ?? 0),
			z: Math.round(player.z ?? 0),
			health: Math.round((player.health ?? 20) * 10) / 10
		}));
		const value: ServerStatus = {
			online: true,
			playerCount: data.currentcount ?? players.length,
			players: players.sort((a, b) => a.name.localeCompare(b.name)),
			fetchedAt: Date.now()
		};
		globalScope.__ms3DynmapCache = { at: Date.now(), value };
		return value;
	} catch {
		// The market should keep working even when the Minecraft map is offline.
		globalScope.__ms3DynmapCache = { at: Date.now(), value: fallback };
		return fallback;
	}
}
