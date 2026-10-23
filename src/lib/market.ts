/**
 * Shared market configuration. Safe to import from the browser, the SvelteKit
 * server and the Discord bot.
 */
export const SITE = {
	name: 'Settlers Market',
	server: 'Settlers III',
	world: 'Caeldun',
	currency: 'coins',
	currencyShort: 'c',
	mapUrl: 'https://play.settlers-mc.org/',
	mapWorld: 'Caeldun',
	defaultMap: 'flat',
	maps: [
		{ id: 'flat', label: 'Flat' },
		{ id: 'surface', label: 'Surface' }
	],
	discordInvite: ''
} as const;

export type MapId = (typeof SITE.maps)[number]['id'];

export interface MapTarget {
	x?: number | null;
	y?: number | null;
	z?: number | null;
	map?: string;
	zoom?: number;
}

/**
 * Dynmap accepts worldname/mapname/x/y/z/zoom as query parameters.
 * `nopanel` hides the Dynmap sidebar for a cleaner embedded surface.
 */
export function mapUrl(target: MapTarget = {}, options: { panel?: boolean } = {}): string {
	const params = new URLSearchParams();
	params.set('worldname', SITE.mapWorld);
	params.set('mapname', target.map ?? SITE.defaultMap);
	if (target.x !== undefined && target.x !== null) params.set('x', String(Math.round(target.x)));
	if (target.y !== undefined && target.y !== null) params.set('y', String(Math.round(target.y)));
	if (target.z !== undefined && target.z !== null) params.set('z', String(Math.round(target.z)));
	params.set('zoom', String(target.zoom ?? 2));
	if (!options.panel) {
		params.set('nopanel', 'true');
		params.set('nocompass', 'true');
	}
	return `${SITE.mapUrl}?${params.toString()}`;
}

export const SIDES = [
	{ id: 'buy', label: 'Buy order', verb: 'Buying', blurb: 'You pay coins and want items.' },
	{ id: 'sell', label: 'Sell offer', verb: 'Selling', blurb: 'You hand over items and want coins.' }
] as const;

export type Side = (typeof SIDES)[number]['id'];

export const CATEGORIES = [
	{ id: 'ores', label: 'Ores & metals', hue: 'cyan' },
	{ id: 'mobs', label: 'Mob drops', hue: 'violet' },
	{ id: 'farming', label: 'Farming', hue: 'lime' },
	{ id: 'blocks', label: 'Building & bulk', hue: 'amber' },
	{ id: 'rare', label: 'Rare & endgame', hue: 'rose' },
	{ id: 'utility', label: 'Utility', hue: 'sky' }
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export interface Item {
	id: string;
	name: string;
	category: CategoryId;
	/** Path inside the Minecraft asset texture folder, without `.png`. */
	texture: string;
	aliases?: string;
}

/** Convenience helper for the texture CDN. */
export const itemTexture = (item: Item) =>
	`https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@1.20.4/assets/minecraft/textures/${item.texture}.png`;

/**
 * Curated trading catalogue for the server. Add or remove entries freely — the
 * rest of the app derives its pickers and filters from this list.
 */
export const ITEMS: Item[] = [
	// Ores & metals
	{ id: 'diamond', name: 'Diamond', category: 'ores', texture: 'item/diamond' },
	{ id: 'diamond_block', name: 'Block of Diamond', category: 'ores', texture: 'block/diamond_block' },
	{ id: 'netherite_ingot', name: 'Netherite Ingot', category: 'ores', texture: 'item/netherite_ingot' },
	{ id: 'netherite_scrap', name: 'Netherite Scrap', category: 'ores', texture: 'item/netherite_scrap' },
	{ id: 'ancient_debris', name: 'Ancient Debris', category: 'ores', texture: 'block/ancient_debris_side' },
	{ id: 'iron_ingot', name: 'Iron Ingot', category: 'ores', texture: 'item/iron_ingot' },
	{ id: 'iron_block', name: 'Block of Iron', category: 'ores', texture: 'block/iron_block' },
	{ id: 'gold_ingot', name: 'Gold Ingot', category: 'ores', texture: 'item/gold_ingot' },
	{ id: 'gold_block', name: 'Block of Gold', category: 'ores', texture: 'block/gold_block' },
	{ id: 'copper_ingot', name: 'Copper Ingot', category: 'ores', texture: 'item/copper_ingot' },
	{ id: 'copper_block', name: 'Block of Copper', category: 'ores', texture: 'block/copper_block' },
	{ id: 'emerald', name: 'Emerald', category: 'ores', texture: 'item/emerald' },
	{ id: 'emerald_block', name: 'Block of Emerald', category: 'ores', texture: 'block/emerald_block' },
	{ id: 'coal', name: 'Coal', category: 'ores', texture: 'item/coal' },
	{ id: 'charcoal', name: 'Charcoal', category: 'ores', texture: 'item/charcoal' },
	{ id: 'redstone', name: 'Redstone Dust', category: 'ores', texture: 'item/redstone' },
	{ id: 'lapis_lazuli', name: 'Lapis Lazuli', category: 'ores', texture: 'item/lapis_lazuli' },
	{ id: 'quartz', name: 'Nether Quartz', category: 'ores', texture: 'item/quartz' },
	{ id: 'amethyst_shard', name: 'Amethyst Shard', category: 'ores', texture: 'item/amethyst_shard' },
	{ id: 'raw_iron', name: 'Raw Iron', category: 'ores', texture: 'item/raw_iron' },
	{ id: 'raw_gold', name: 'Raw Gold', category: 'ores', texture: 'item/raw_gold' },

	// Mob drops
	{ id: 'gunpowder', name: 'Gunpowder', category: 'mobs', texture: 'item/gunpowder' },
	{ id: 'string', name: 'String', category: 'mobs', texture: 'item/string' },
	{ id: 'spider_eye', name: 'Spider Eye', category: 'mobs', texture: 'item/spider_eye' },
	{ id: 'ender_pearl', name: 'Ender Pearl', category: 'mobs', texture: 'item/ender_pearl' },
	{ id: 'blaze_rod', name: 'Blaze Rod', category: 'mobs', texture: 'item/blaze_rod' },
	{ id: 'slime_ball', name: 'Slimeball', category: 'mobs', texture: 'item/slime_ball' },
	{ id: 'ghast_tear', name: 'Ghast Tear', category: 'mobs', texture: 'item/ghast_tear' },
	{ id: 'phantom_membrane', name: 'Phantom Membrane', category: 'mobs', texture: 'item/phantom_membrane' },
	{ id: 'rabbit_foot', name: "Rabbit's Foot", category: 'mobs', texture: 'item/rabbit_foot' },
	{ id: 'shulker_shell', name: 'Shulker Shell', category: 'mobs', texture: 'item/shulker_shell' },
	{ id: 'nether_star', name: 'Nether Star', category: 'mobs', texture: 'item/nether_star' },
	{ id: 'totem_of_undying', name: 'Totem of Undying', category: 'mobs', texture: 'item/totem_of_undying' },
	{ id: 'experience_bottle', name: 'Bottle o’ Enchanting', category: 'mobs', texture: 'item/experience_bottle' },

	// Farming
	{ id: 'wheat', name: 'Wheat', category: 'farming', texture: 'item/wheat' },
	{ id: 'carrot', name: 'Carrot', category: 'farming', texture: 'item/carrot' },
	{ id: 'potato', name: 'Potato', category: 'farming', texture: 'item/potato' },
	{ id: 'beetroot', name: 'Beetroot', category: 'farming', texture: 'item/beetroot' },
	{ id: 'sugar_cane', name: 'Sugar Cane', category: 'farming', texture: 'item/sugar_cane' },
	{ id: 'melon_slice', name: 'Melon Slice', category: 'farming', texture: 'item/melon_slice' },
	{ id: 'pumpkin', name: 'Pumpkin', category: 'farming', texture: 'block/pumpkin_side' },
	{ id: 'cocoa_beans', name: 'Cocoa Beans', category: 'farming', texture: 'item/cocoa_beans' },
	{ id: 'honeycomb', name: 'Honeycomb', category: 'farming', texture: 'item/honeycomb' },
	{ id: 'bamboo', name: 'Bamboo', category: 'farming', texture: 'item/bamboo' },
	{ id: 'kelp', name: 'Kelp', category: 'farming', texture: 'item/kelp' },

	// Building & bulk
	{ id: 'oak_log', name: 'Oak Log', category: 'blocks', texture: 'block/oak_log' },
	{ id: 'spruce_log', name: 'Spruce Log', category: 'blocks', texture: 'block/spruce_log' },
	{ id: 'stone', name: 'Stone', category: 'blocks', texture: 'block/stone' },
	{ id: 'cobblestone', name: 'Cobblestone', category: 'blocks', texture: 'block/cobblestone' },
	{ id: 'deepslate', name: 'Deepslate', category: 'blocks', texture: 'block/deepslate' },
	{ id: 'glass', name: 'Glass', category: 'blocks', texture: 'block/glass' },
	{ id: 'sand', name: 'Sand', category: 'blocks', texture: 'block/sand' },
	{ id: 'gravel', name: 'Gravel', category: 'blocks', texture: 'block/gravel' },
	{ id: 'terracotta', name: 'Terracotta', category: 'blocks', texture: 'block/terracotta' },
	{ id: 'white_wool', name: 'White Wool', category: 'blocks', texture: 'block/white_wool' },
	{ id: 'obsidian', name: 'Obsidian', category: 'blocks', texture: 'block/obsidian' },
	{ id: 'crying_obsidian', name: 'Crying Obsidian', category: 'blocks', texture: 'block/crying_obsidian' },
	{ id: 'end_stone', name: 'End Stone', category: 'blocks', texture: 'block/end_stone' },
	{ id: 'netherrack', name: 'Netherrack', category: 'blocks', texture: 'block/netherrack' },
	{ id: 'packed_ice', name: 'Packed Ice', category: 'blocks', texture: 'block/packed_ice' },
	{ id: 'sponge', name: 'Sponge', category: 'blocks', texture: 'block/sponge' },

	// Rare & endgame
	{ id: 'elytra', name: 'Elytra', category: 'rare', texture: 'item/elytra' },
	{ id: 'trident', name: 'Trident', category: 'rare', texture: 'item/trident' },
	{ id: 'enchanted_golden_apple', name: 'Enchanted Golden Apple', category: 'rare', texture: 'item/golden_apple' },
	{ id: 'end_crystal', name: 'End Crystal', category: 'rare', texture: 'item/end_crystal' },
	{ id: 'wither_rose', name: 'Wither Rose', category: 'rare', texture: 'item/wither_rose' },
	{ id: 'dragon_breath', name: 'Dragon’s Breath', category: 'rare', texture: 'item/dragon_breath' },

	// Utility
	{ id: 'name_tag', name: 'Name Tag', category: 'utility', texture: 'item/name_tag' },
	{ id: 'saddle', name: 'Saddle', category: 'utility', texture: 'item/saddle' },
	{ id: 'enchanted_book', name: 'Enchanted Book', category: 'utility', texture: 'item/enchanted_book' },
	{ id: 'arrow', name: 'Arrow', category: 'utility', texture: 'item/arrow' },
	{ id: 'tnt', name: 'TNT', category: 'utility', texture: 'block/tnt' },
	{ id: 'firework_rocket', name: 'Firework Rocket', category: 'utility', texture: 'item/firework_rocket' },
	{ id: 'golden_carrot', name: 'Golden Carrot', category: 'utility', texture: 'item/golden_carrot' },
	{ id: 'cooked_beef', name: 'Steak', category: 'utility', texture: 'item/cooked_beef' }
];

export const ITEM_MAP: ReadonlyMap<string, Item> = new Map(ITEMS.map((item) => [item.id, item]));

export function getItem(id: string): Item | undefined {
	return ITEM_MAP.get(id);
}

export function searchItems(query: string, category?: CategoryId | 'all'): Item[] {
	const q = query.trim().toLowerCase();
	return ITEMS.filter((item) => {
		if (category && category !== 'all' && item.category !== category) return false;
		if (!q) return true;
		return (
			item.name.toLowerCase().includes(q) ||
			item.id.includes(q) ||
			(item.aliases ?? '').toLowerCase().includes(q)
		);
	});
}

export type OfferStatus = 'open' | 'filled' | 'cancelled';
export type OfferSource = 'web' | 'discord' | 'seed';

export interface Offer {
	id: string;
	side: Side;
	itemId: string;
	quantity: number;
	price: number;
	ign: string;
	guild: string;
	contact: string;
	world: string;
	x: number | null;
	y: number | null;
	z: number | null;
	note: string;
	status: OfferStatus;
	source: OfferSource;
	createdAt: number;
	updatedAt: number;
	/** True when the request carried the offer's edit token. */
	mine?: boolean;
}

export interface PricePoint {
	ts: number;
	bid: number | null;
	ask: number | null;
	mid: number | null;
}

export interface ItemMarket {
	itemId: string;
	bestBid: number | null;
	bestAsk: number | null;
	bidQty: number;
	askQty: number;
	bidQtyTotal: number;
	askQtyTotal: number;
	bidCount: number;
	askCount: number;
	mid: number | null;
	spread: number | null;
	spreadPct: number | null;
	changePct: number | null;
	history: PricePoint[];
	lastUpdated: number | null;
}

export interface Alert {
	id: string;
	itemId: string;
	kind: 'price-up' | 'price-down' | 'new-high' | 'new-low';
	side: Side;
	price: number;
	previous: number | null;
	changePct: number | null;
	message: string;
	createdAt: number;
	postedAt: number | null;
}

export interface MarketSummary {
	openBuys: number;
	openSells: number;
	buyQty: number;
	sellQty: number;
	bids: number;
	asks: number;
	offers24h: number;
	traders: number;
	guilds: number;
	listedValue: number;
}

export interface MarketResponse {
	offers: Offer[];
	recent: Offer[];
	items: ItemMarket[];
	alerts: Alert[];
	summary: MarketSummary;
	guilds: string[];
	hasDemo: boolean;
	revision: number;
	serverTime: number;
	thresholdPct: number;
}

export interface BotStatus {
	configured: boolean;
	online: boolean;
	tag: string | null;
	guildCount: number | null;
	lastSeen: number | null;
	alertChannelId: string | null;
	alertChannelName: string | null;
	thresholdPct: number;
	cooldownMinutes: number;
	pollSeconds: number;
	inviteUrl: string | null;
}

export interface ServerStatus {
	online: boolean;
	playerCount: number;
	players: { name: string; x: number; y: number; z: number; health: number }[];
	fetchedAt: number;
}
