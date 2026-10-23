import type { Offer } from '../market';
import {
	assertOk,
	bumpRevision,
	newEditToken,
	newId,
	supabase,
	type OfferRow
} from './db';
import { refreshMarketState } from './market-supabase';
import {
	toOffer,
	verifyToken,
	type ListOptions,
	type OfferCounts,
	type PlayerSummary
} from './offers-core';
import { fetchAllRows } from './supabase-utils';
import type { OfferInput, OfferPatch } from './validation';
import { InputError } from './validation';

export async function listOffers(options: ListOptions = {}): Promise<Offer[]> {
	let query = supabase().from('offers').select('*');

	if (options.status && options.status !== 'all') query = query.eq('status', options.status);
	if (options.side) query = query.eq('side', options.side);
	if (options.itemId) query = query.eq('item_id', options.itemId);
	if (options.ign) query = query.ilike('ign', options.ign);
	if (options.guild) query = query.ilike('guild', options.guild);

	const limit = Math.min(Math.max(Math.trunc(options.limit ?? 300), 1), 1000);
	const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
	assertOk(error, 'list offers');
	return ((data ?? []) as OfferRow[]).map(toOffer);
}

export async function getOfferRow(id: string): Promise<OfferRow | undefined> {
	const { data, error } = await supabase()
		.from('offers')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	assertOk(error, 'read offer');
	return (data ?? undefined) as OfferRow | undefined;
}

export async function getOffer(id: string): Promise<Offer | undefined> {
	const row = await getOfferRow(id);
	return row ? toOffer(row) : undefined;
}

export async function createOffer(
	input: OfferInput,
	options: { source?: 'web' | 'discord' | 'seed'; ign?: string } = {}
): Promise<{ offer: Offer; editToken: string }> {
	const id = newId();
	const editToken = newEditToken();
	const now = Date.now();

	const { data, error } = await supabase()
		.from('offers')
		.insert({
			id,
			side: input.side,
			item_id: input.itemId,
			quantity: input.quantity,
			price: input.price,
			ign: options.ign ?? input.ign,
			guild: input.guild,
			contact: input.contact,
			world: input.world,
			x: input.x,
			y: input.y,
			z: input.z,
			note: input.note,
			status: 'open',
			source: options.source ?? 'web',
			edit_token: editToken,
			created_at: now,
			updated_at: now
		})
		.select('*')
		.single();
	assertOk(error, 'create offer');

	await refreshMarketState(input.itemId);
	await bumpRevision();

	return { offer: toOffer(data as OfferRow), editToken };
}

export async function updateOffer(
	id: string,
	patch: OfferPatch,
	token: string | null | undefined
): Promise<Offer> {
	const row = await getOfferRow(id);
	if (!row) throw Object.assign(new Error('Offer not found.'), { status: 404 });
	verifyToken(row, token);

	const changes: Record<string, string | number | null> = {};
	if (patch.quantity !== undefined) changes.quantity = patch.quantity;
	if (patch.price !== undefined) changes.price = patch.price;
	if (patch.guild !== undefined) changes.guild = patch.guild;
	if (patch.contact !== undefined) changes.contact = patch.contact;
	if (patch.note !== undefined) changes.note = patch.note;
	if (patch.x !== undefined) changes.x = patch.x;
	if (patch.y !== undefined) changes.y = patch.y;
	if (patch.z !== undefined) changes.z = patch.z;
	if (patch.status !== undefined) changes.status = patch.status;
	if (!Object.keys(changes).length) throw new InputError('Nothing to update.');
	changes.updated_at = Date.now();

	const { data, error } = await supabase()
		.from('offers')
		.update(changes)
		.eq('id', id)
		.select('*')
		.single();
	assertOk(error, 'update offer');

	await refreshMarketState(row.item_id);
	await bumpRevision();
	return toOffer(data as OfferRow);
}

export async function cancelOffer(
	id: string,
	token: string | null | undefined,
	status: 'cancelled' | 'filled' = 'cancelled'
): Promise<Offer> {
	const row = await getOfferRow(id);
	if (!row) throw Object.assign(new Error('Offer not found.'), { status: 404 });
	verifyToken(row, token);
	if (row.status === status) return toOffer(row);

	const { data, error } = await supabase()
		.from('offers')
		.update({ status, updated_at: Date.now() })
		.eq('id', id)
		.select('*')
		.single();
	assertOk(error, 'cancel offer');

	await refreshMarketState(row.item_id);
	await bumpRevision();
	return toOffer(data as OfferRow);
}

export async function countOpenOffersForIgn(ign: string): Promise<number> {
	const { count, error } = await supabase()
		.from('offers')
		.select('id', { count: 'exact', head: true })
		.eq('status', 'open')
		.ilike('ign', ign);
	assertOk(error, 'count player offers');
	return count ?? 0;
}

export async function getGuilds(limit = 24): Promise<string[]> {
	const rows = await fetchAllRows<{ guild: string | null }>(
		(from, to) =>
			supabase()
				.from('offers')
				.select('guild')
				.eq('status', 'open')
				.neq('guild', '')
				.order('id', { ascending: true })
				.range(from, to),
		'list guilds'
	);

	const counts = new Map<string, number>();
	for (const row of rows) {
		if (!row.guild) continue;
		counts.set(row.guild, (counts.get(row.guild) ?? 0) + 1);
	}
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, limit)
		.map(([guild]) => guild);
}

export async function getPlayerSummary(ign: string): Promise<PlayerSummary> {
	const { data, error } = await supabase()
		.from('offers')
		.select('*')
		.ilike('ign', ign)
		.order('created_at', { ascending: false })
		.limit(100);
	assertOk(error, 'read player summary');

	const rows = ((data ?? []) as OfferRow[]).sort(
		(a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.created_at - a.created_at
	);

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

export async function getOfferCounts(): Promise<OfferCounts> {
	const now = Date.now();
	const dayAgo = now - 24 * 60 * 60 * 1000;
	const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
	const rows = await fetchAllRows<{ created_at: number; ign: string }>(
		(from, to) =>
			supabase()
				.from('offers')
				.select('created_at,ign')
				.gte('created_at', weekAgo)
				.order('created_at', { ascending: true })
				.order('id', { ascending: true })
				.range(from, to),
		'read offer counts'
	);

	const traders = new Set<string>();
	let offers24h = 0;
	for (const row of rows) {
		traders.add(row.ign.toLowerCase());
		if (row.created_at >= dayAgo) offers24h += 1;
	}
	return { offers24h, traders: traders.size };
}

export async function hasSeedOffers(): Promise<boolean> {
	const { data, error } = await supabase()
		.from('offers')
		.select('id')
		.eq('source', 'seed')
		.limit(1)
		.maybeSingle();
	assertOk(error, 'check demo data');
	return Boolean(data);
}
