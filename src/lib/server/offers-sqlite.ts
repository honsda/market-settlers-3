import type { Offer } from '../market';
import {
	db,
	bumpRevisionSync,
	newEditToken,
	newId,
	transaction,
	type OfferRow
} from './db';
import { refreshMarketState } from './market-sqlite';
import {
	toOffer,
	verifyToken,
	type ListOptions,
	type OfferCounts,
	type PlayerSummary
} from './offers-core';
import type { OfferInput, OfferPatch } from './validation';
import { InputError } from './validation';

export function listOffers(options: ListOptions = {}): Offer[] {
	const where: string[] = [];
	const params: (string | number)[] = [];

	if (options.status && options.status !== 'all') {
		where.push('status = ?');
		params.push(options.status);
	}
	if (options.side) {
		where.push('side = ?');
		params.push(options.side);
	}
	if (options.itemId) {
		where.push('item_id = ?');
		params.push(options.itemId);
	}
	if (options.ign) {
		where.push('LOWER(ign) = LOWER(?)');
		params.push(options.ign);
	}
	if (options.guild) {
		where.push('LOWER(guild) = LOWER(?)');
		params.push(options.guild);
	}

	const limit = Math.min(Math.max(Math.trunc(options.limit ?? 300), 1), 1000);
	const sql = `SELECT * FROM offers
		${where.length ? `WHERE ${where.join(' AND ')}` : ''}
		ORDER BY created_at DESC
		LIMIT ?`;
	params.push(limit);

	const rows = db.prepare(sql).all(...params) as unknown as OfferRow[];
	return rows.map(toOffer);
}

export function getOfferRow(id: string): OfferRow | undefined {
	return db.prepare('SELECT * FROM offers WHERE id = ?').get(id) as unknown as OfferRow | undefined;
}

export function getOffer(id: string): Offer | undefined {
	const row = getOfferRow(id);
	return row ? toOffer(row) : undefined;
}

export function createOffer(
	input: OfferInput,
	options: { source?: 'web' | 'discord' | 'seed'; ign?: string } = {}
): { offer: Offer; editToken: string } {
	const id = newId();
	const editToken = newEditToken();
	const now = Date.now();

	transaction(() => {
		db.prepare(
			`INSERT INTO offers
				(id, side, item_id, quantity, price, ign, guild, contact, world, x, y, z, note, status, source, edit_token, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`
		).run(
			id,
			input.side,
			input.itemId,
			input.quantity,
			input.price,
			options.ign ?? input.ign,
			input.guild,
			input.contact,
			input.world,
			input.x,
			input.y,
			input.z,
			input.note,
			options.source ?? 'web',
			editToken,
			now,
			now
		);
		refreshMarketState(input.itemId);
		bumpRevisionSync();
	});

	const offer = getOffer(id);
	if (!offer) throw new Error('Offer vanished after saving.');
	return { offer, editToken };
}

export function updateOffer(
	id: string,
	patch: OfferPatch,
	token: string | null | undefined
): Offer {
	const row = getOfferRow(id);
	if (!row) throw Object.assign(new Error('Offer not found.'), { status: 404 });
	verifyToken(row, token);

	const sets: string[] = [];
	const params: (string | number | null)[] = [];

	const assign = (column: string, value: string | number | null) => {
		sets.push(`${column} = ?`);
		params.push(value);
	};

	if (patch.quantity !== undefined) assign('quantity', patch.quantity);
	if (patch.price !== undefined) assign('price', patch.price);
	if (patch.guild !== undefined) assign('guild', patch.guild);
	if (patch.contact !== undefined) assign('contact', patch.contact);
	if (patch.note !== undefined) assign('note', patch.note);
	if (patch.x !== undefined) assign('x', patch.x);
	if (patch.y !== undefined) assign('y', patch.y);
	if (patch.z !== undefined) assign('z', patch.z);
	if (patch.status !== undefined) assign('status', patch.status);
	if (!sets.length) throw new InputError('Nothing to update.');
	assign('updated_at', Date.now());

	transaction(() => {
		params.push(id);
		db.prepare(`UPDATE offers SET ${sets.join(', ')} WHERE id = ?`).run(...params);
		refreshMarketState(row.item_id);
		bumpRevisionSync();
	});

	const updated = getOffer(id);
	if (!updated) throw new Error('Offer vanished after update.');
	return updated;
}

export function cancelOffer(
	id: string,
	token: string | null | undefined,
	status: 'cancelled' | 'filled' = 'cancelled'
): Offer {
	const row = getOfferRow(id);
	if (!row) throw Object.assign(new Error('Offer not found.'), { status: 404 });
	verifyToken(row, token);
	if (row.status === status) return toOffer(row);

	transaction(() => {
		db.prepare('UPDATE offers SET status = ?, updated_at = ? WHERE id = ?').run(
			status,
			Date.now(),
			id
		);
		refreshMarketState(row.item_id);
		bumpRevisionSync();
	});

	const updated = getOffer(id);
	if (!updated) throw new Error('Offer vanished after cancelling.');
	return updated;
}

export function countOpenOffersForIgn(ign: string): number {
	const row = db
		.prepare(
			`SELECT COUNT(*) AS count FROM offers
			 WHERE status = 'open' AND LOWER(ign) = LOWER(?)`
		)
		.get(ign) as { count: number };
	return row.count;
}

export function getGuilds(limit = 24): string[] {
	const rows = db
		.prepare(
			`SELECT guild, COUNT(*) AS count FROM offers
			 WHERE status = 'open' AND guild IS NOT NULL AND guild <> ''
			 GROUP BY guild ORDER BY count DESC, guild ASC LIMIT ?`
		)
		.all(limit) as unknown as { guild: string; count: number }[];
	return rows.map((row) => row.guild);
}

export function getPlayerSummary(ign: string): PlayerSummary {
	const rows = db
		.prepare(
			`SELECT * FROM offers
			 WHERE LOWER(ign) = LOWER(?)
			 ORDER BY (status = 'open') DESC, created_at DESC
			 LIMIT 100`
		)
		.all(ign) as unknown as OfferRow[];

	let openBuys = 0;
	let openSells = 0;
	let bidValue = 0;
	let askValue = 0;
	let guild: string | null = null;
	let lastSeen: number | null = null;

	for (const row of rows) {
		if (row.guild) guild = row.guild;
		lastSeen = Math.max(lastSeen ?? 0, row.created_at);
		if (row.status !== 'open') continue;
		if (row.side === 'buy') {
			openBuys += 1;
			bidValue += row.quantity * row.price;
		} else {
			openSells += 1;
			askValue += row.quantity * row.price;
		}
	}

	return {
		ign,
		guild,
		openBuys,
		openSells,
		bidValue,
		askValue,
		lastSeen,
		forOffer: rows[0] ? toOffer(rows[0]) : null
	};
}

export function getOfferCounts(): OfferCounts {
	const now = Date.now();
	const dayAgo = now - 24 * 60 * 60 * 1000;
	const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
	const offers24h = (
		db.prepare('SELECT COUNT(*) AS count FROM offers WHERE created_at >= ?').get(dayAgo) as {
			count: number;
		}
	).count;
	const traders = (
		db
			.prepare('SELECT COUNT(DISTINCT LOWER(ign)) AS count FROM offers WHERE created_at >= ?')
			.get(weekAgo) as { count: number }
	).count;
	return { offers24h, traders };
}

export function hasSeedOffers(): boolean {
	return Boolean(
		db.prepare(`SELECT 1 AS hit FROM offers WHERE source = 'seed' LIMIT 1`).get()
	);
}
