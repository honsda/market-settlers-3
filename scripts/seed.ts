/**
 * Populate the market with a believable demo book.
 *
 *   npm run db:seed          # fresh database, or existing demo data
 *   npm run db:seed -- --force
 *   npm run db:reset          # wipe and reseed from scratch
 *
 * Everything inserted here is marked `source = 'seed'` (or a `seed-*` alert
 * id) so the dashboard can show a "demo data" banner and the bot has something
 * to display without messaging a real Discord server.
 */
import { db, bumpRevisionSync, newEditToken, newId, transaction } from '../src/lib/server/db';
import { getBestPrices } from '../src/lib/server/market-sqlite';
import { serverEnv } from '../src/lib/server/env';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const force = process.argv.includes('--force');

interface SeedItem {
	id: string;
	mid: number;
	/** Typical lot size for this item. */
	lots: number[];
	phase: number;
	volatility: number;
}

const SEED_ITEMS: SeedItem[] = [
	{ id: 'diamond', mid: 940, lots: [16, 32, 64], phase: 0.4, volatility: 0.08 },
	{ id: 'diamond_block', mid: 8800, lots: [4, 8, 16], phase: 1.3, volatility: 0.06 },
	{ id: 'netherite_ingot', mid: 4200, lots: [1, 2, 4], phase: 2.2, volatility: 0.09 },
	{ id: 'ancient_debris', mid: 780, lots: [8, 16, 32], phase: 3.1, volatility: 0.11 },
	{ id: 'emerald', mid: 420, lots: [16, 32, 64], phase: 4.0, volatility: 0.1 },
	{ id: 'iron_ingot', mid: 18, lots: [64, 128, 256], phase: 0.9, volatility: 0.07 },
	{ id: 'gold_ingot', mid: 22, lots: [64, 128, 256], phase: 1.7, volatility: 0.08 },
	{ id: 'coal', mid: 6, lots: [128, 256, 512], phase: 2.6, volatility: 0.12 },
	{ id: 'redstone', mid: 4.5, lots: [128, 256, 512], phase: 3.5, volatility: 0.13 },
	{ id: 'lapis_lazuli', mid: 12, lots: [64, 128, 256], phase: 4.4, volatility: 0.1 },
	{ id: 'quartz', mid: 9, lots: [64, 128, 256], phase: 5.2, volatility: 0.11 },
	{ id: 'gunpowder', mid: 7, lots: [64, 128, 256], phase: 0.2, volatility: 0.14 },
	{ id: 'ender_pearl', mid: 55, lots: [16, 32, 64], phase: 1.1, volatility: 0.12 },
	{ id: 'blaze_rod', mid: 38, lots: [16, 32, 64], phase: 2.0, volatility: 0.13 },
	{ id: 'slime_ball', mid: 14, lots: [32, 64, 128], phase: 2.9, volatility: 0.15 },
	{ id: 'shulker_shell', mid: 260, lots: [4, 8, 16], phase: 3.8, volatility: 0.12 },
	{ id: 'totem_of_undying', mid: 1400, lots: [1, 2, 4], phase: 4.7, volatility: 0.1 },
	{ id: 'elytra', mid: 12_000, lots: [1, 2], phase: 5.6, volatility: 0.14 },
	{ id: 'nether_star', mid: 9000, lots: [1, 2], phase: 0.7, volatility: 0.16 },
	{ id: 'wheat', mid: 2.5, lots: [256, 512, 1024], phase: 1.5, volatility: 0.09 },
	{ id: 'carrot', mid: 1.8, lots: [256, 512, 1024], phase: 2.4, volatility: 0.09 },
	{ id: 'sugar_cane', mid: 3, lots: [256, 512, 1024], phase: 3.3, volatility: 0.1 },
	{ id: 'oak_log', mid: 4, lots: [128, 256, 512], phase: 4.2, volatility: 0.08 },
	{ id: 'stone', mid: 1.2, lots: [512, 1024, 2048], phase: 5.1, volatility: 0.07 },
	{ id: 'glass', mid: 3, lots: [128, 256, 512], phase: 0.5, volatility: 0.09 },
	{ id: 'obsidian', mid: 10, lots: [64, 128, 256], phase: 1.9, volatility: 0.1 },
	{ id: 'sponge', mid: 450, lots: [4, 8, 16], phase: 2.8, volatility: 0.13 }
];

const TRADERS = [
	{ ign: 'Fenwick', guild: 'Ironhold Trading Co.' },
	{ ign: 'Mirelle', guild: 'The Gilded Ledger' },
	{ ign: 'Bastion_77', guild: 'Stonewatch' },
	{ ign: 'Quillon', guild: '' },
	{ ign: 'AshenFox', guild: 'Night Market' },
	{ ign: 'Tarn_Vex', guild: 'Ironhold Trading Co.' },
	{ ign: 'Pipwick', guild: '' },
	{ ign: 'Sable_Rook', guild: 'The Gilded Ledger' },
	{ ign: 'Orrin_Clay', guild: 'Stonewatch' },
	{ ign: 'Wren', guild: 'Night Market' }
];

const NOTES = [
	'Meet at the spawn market.',
	'Online most evenings — DM me on Discord.',
	'Can deliver to your base for a small fee.',
	'Bulk deals welcome.',
	'Trading from the north harbour warehouse.',
	''
];

/** Small deterministic PRNG so reseeding produces the same friendly demo. */
function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function roundPrice(value: number): number {
	if (value >= 500) return Math.max(1, Math.round(value / 5) * 5);
	if (value >= 20) return Math.max(1, Math.round(value));
	if (value >= 1) return Math.max(0.1, Math.round(value * 10) / 10);
	return Math.max(0.01, Math.round(value * 100) / 100);
}

function pick<T>(rng: () => number, list: T[]): T {
	return list[Math.floor(rng() * list.length)];
}

function countRows(sql: string, ...params: (string | number)[]): number {
	const row = db.prepare(sql).get(...params) as { count: number };
	return row.count;
}

const totalOffers = countRows('SELECT COUNT(*) AS count FROM offers');
const seedOffers = countRows("SELECT COUNT(*) AS count FROM offers WHERE source = 'seed'");

if (seedOffers && !force) {
	console.log(`Demo data is already present (${seedOffers} seeded offers). Use --force to rebuild it.`);
	db.close();
	process.exit(0);
}

if (totalOffers && !seedOffers && !force) {
	console.error(
		[
			'',
			'Refusing to seed over an existing market. This is a demo dataset, not real history.',
			'',
			'  npm run db:reset           wipe the local database and reseed',
			'  npm run db:seed -- --force reseed in place (deletes previous demo rows)',
			''
		].join('\n')
	);
	db.close();
	process.exit(1);
}

const rng = mulberry32(0x5e7713);
const now = Date.now();
let insertedOffers = 0;
let insertedHistory = 0;
let insertedAlerts = 0;

const insertOffer = db.prepare(
	`INSERT INTO offers
		(id, side, item_id, quantity, price, ign, guild, contact, world, x, y, z, note, status, source, edit_token, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', ?, ?, ?)`
);
const insertHistory = db.prepare(
	`INSERT INTO price_history (item_id, bid, ask, ts) VALUES (?, ?, ?, ?)`
);

transaction(() => {
	// Rebuild only the demo slice, never real offers posted by people.
	db.prepare("DELETE FROM offers WHERE source = 'seed'").run();
	db.prepare("DELETE FROM alerts WHERE id LIKE 'seed-%'").run();
	const placeholders = SEED_ITEMS.map(() => '?').join(', ');
	db.prepare(`DELETE FROM price_history WHERE item_id IN (${placeholders})`).run(
		...SEED_ITEMS.map((item) => item.id)
	);

	for (const item of SEED_ITEMS) {
		const buyCount = 1 + Math.floor(rng() * 2);
		const sellCount = 1 + Math.floor(rng() * 2);
		const used = new Set<string>();

		const addOffer = (side: 'buy' | 'sell', price: number, ageMinutes: number) => {
			let trader = pick(rng, TRADERS);
			let guard = 0;
			while (used.has(trader.ign) && guard < 10) {
				trader = pick(rng, TRADERS);
				guard += 1;
			}
			used.add(trader.ign);

			const quantity = pick(rng, item.lots);
			const hasLocation = rng() > 0.3;
			const x = hasLocation ? Math.round((rng() - 0.5) * 900) : null;
			const z = hasLocation ? Math.round((rng() - 0.5) * 900) : null;
			const y = hasLocation ? 64 + Math.floor(rng() * 8) : null;
			const created = now - Math.round(ageMinutes * 60_000);

			insertOffer.run(
				newId(),
				side,
				item.id,
				quantity,
				roundPrice(price),
				trader.ign,
				trader.guild,
				rng() > 0.65 ? `${trader.ign.toLowerCase()}@discord` : '',
				'Caeldun',
				x,
				y,
				z,
				pick(rng, NOTES),
				'open',
				newEditToken(),
				created,
				created
			);
			insertedOffers += 1;
		};

		for (let index = 0; index < buyCount; index += 1) {
			const discount = 0.9 + rng() * 0.06 - index * 0.03;
			addOffer('buy', item.mid * discount, 20 + rng() * 2600);
		}
		for (let index = 0; index < sellCount; index += 1) {
			const premium = 1.04 + rng() * 0.07 + index * 0.03;
			addOffer('sell', item.mid * premium, 20 + rng() * 2600);
		}

		// A couple of closed offers give the activity feed some texture.
		if (rng() > 0.55) {
			const created = now - Math.floor(rng() * 3 * DAY);
			insertOffer.run(
				newId(),
				rng() > 0.5 ? 'buy' : 'sell',
				item.id,
				pick(rng, item.lots),
				roundPrice(item.mid * (0.97 + rng() * 0.07)),
				pick(rng, TRADERS).ign,
				pick(rng, TRADERS).guild,
				'',
				'Caeldun',
				null,
				null,
				null,
				'',
				rng() > 0.5 ? 'filled' : 'cancelled',
				newEditToken(),
				created,
				created + HOUR
			);
			insertedOffers += 1;
		}

		const book = getBestPrices(item.id);
		const historyPoints = 28;
		for (let index = 0; index < historyPoints; index += 1) {
			const daysAgo = 14 - (index / (historyPoints - 1)) * 14;
			const ts = Math.round(now - daysAgo * DAY + (rng() - 0.5) * 3 * HOUR);
			const wave = 1 + Math.sin(daysAgo * 0.55 + item.phase) * item.volatility * 0.7;
			const drift = 1 + (rng() - 0.5) * item.volatility;
			const point = item.mid * wave * drift;
			const bid = index === historyPoints - 1 && book.bid !== null ? book.bid : roundPrice(point * 0.955);
			const ask = index === historyPoints - 1 && book.ask !== null ? book.ask : roundPrice(point * 1.045);
			insertHistory.run(item.id, bid, ask, Math.min(ts, now - 60_000));
			insertedHistory += 1;
		}
	}

	const demoAlerts: {
		itemId: string;
		kind: 'price-up' | 'price-down' | 'new-high' | 'new-low';
		side: 'buy' | 'sell';
		price: number;
		previous: number;
		hoursAgo: number;
		text: string;
	}[] = [
		{
			itemId: 'diamond',
			kind: 'price-up',
			side: 'buy',
			price: 965,
			previous: 860,
			hoursAgo: 2.4,
			text: 'Best buy order for Diamond jumped {pct}% to {price} coins (was {prev}).'
		},
		{
			itemId: 'emerald',
			kind: 'new-high',
			side: 'sell',
			price: 470,
			previous: 431,
			hoursAgo: 7.1,
			text: 'New 7-day high for Emerald sell offers: {price} coins (was {prev}).'
		},
		{
			itemId: 'wheat',
			kind: 'price-down',
			side: 'buy',
			price: 2.1,
			previous: 2.6,
			hoursAgo: 13.5,
			text: 'Best buy order for Wheat dropped {pct}% to {price} coins (was {prev}).'
		},
		{
			itemId: 'elytra',
			kind: 'new-low',
			side: 'sell',
			price: 10_800,
			previous: 12_400,
			hoursAgo: 22.2,
			text: 'New 7-day low for Elytra sell offers: {price} coins (was {prev}).'
		}
	];

	const insertAlert = db.prepare(
		`INSERT INTO alerts (id, item_id, kind, side, price, previous, change_pct, message, created_at, posted_at, discord_message_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
	);

	demoAlerts.forEach((alert, index) => {
		const pct = ((alert.price - alert.previous) / alert.previous) * 100;
		const created = now - Math.round(alert.hoursAgo * HOUR);
		const message = alert.text
			.replace('{pct}', Math.abs(pct).toFixed(1))
			.replaceAll('{price}', alert.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
			.replaceAll('{prev}', alert.previous.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
		// Marked as posted so a freshly started bot does not replay the demo feed.
		insertAlert.run(
			`seed-alert-${index + 1}`,
			alert.itemId,
			alert.kind,
			alert.side,
			alert.price,
			alert.previous,
			pct,
			message,
			created,
			created + 60_000
		);
		insertedAlerts += 1;
	});

	bumpRevisionSync();
});

const finalOffers = countRows('SELECT COUNT(*) AS count FROM offers');
const finalOpen = countRows("SELECT COUNT(*) AS count FROM offers WHERE status = 'open'");

console.log(
	[
		'',
		'  Demo market ready.',
		'',
		`  database  ${serverEnv.dbPath}`,
		`  offers    ${insertedOffers} seeded (${finalOffers} total, ${finalOpen} open)`,
		`  history   ${insertedHistory} price points`,
		`  alerts    ${insertedAlerts} demo signals (already marked as posted)`,
		'',
		'  Start everything with:  npm run dev:all',
		''
	].join('\n')
);

db.close();
