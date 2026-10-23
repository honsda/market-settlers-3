import { SITE, getItem, type Side } from '../market';

export class InputError extends Error {
	status = 400;
	constructor(message: string) {
		super(message);
		this.name = 'InputError';
	}
}

export interface OfferInput {
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
}

function text(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	// Strip control characters but keep ordinary punctuation and spaces.
	return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function integer(value: unknown, label: string, min: number, max: number): number {
	const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	if (typeof num !== 'number' || !Number.isFinite(num) || !Number.isInteger(num)) {
		throw new InputError(`${label} must be a whole number.`);
	}
	if (num < min || num > max) {
		throw new InputError(`${label} must be between ${min} and ${max}.`);
	}
	return num;
}

function optionalCoordinate(value: unknown, label: string, min: number, max: number): number | null {
	if (value === null || value === undefined || value === '') return null;
	return integer(value, label, min, max);
}

export function parseOfferInput(body: unknown): OfferInput {
	if (!body || typeof body !== 'object') throw new InputError('Expected a JSON object.');
	const data = body as Record<string, unknown>;

	const side = data.side;
	if (side !== 'buy' && side !== 'sell') throw new InputError('Side must be buy or sell.');

	const itemId = text(data.itemId, 64);
	if (!itemId || !getItem(itemId)) throw new InputError('Pick a valid item.');

	const quantity = integer(data.quantity, 'Quantity', 1, 1_000_000);

	const rawPrice =
		typeof data.price === 'string' && data.price.trim() !== '' ? Number(data.price) : data.price;
	if (typeof rawPrice !== 'number' || !Number.isFinite(rawPrice)) {
		throw new InputError('Price must be a number.');
	}
	const price = Math.round(rawPrice * 100) / 100;
	if (price <= 0) throw new InputError('Price must be greater than zero.');
	if (price > 1_000_000) throw new InputError('Price must be below 1,000,000.');

	const ign = text(data.ign, 16);
	if (!/^[A-Za-z0-9_]{3,16}$/.test(ign)) {
		throw new InputError('IGN must be 3–16 letters, numbers or underscores.');
	}

	const guild = text(data.guild, 32);
	const contact = text(data.contact, 64);
	const world = text(data.world, 40) || SITE.world;
	const note = text(data.note, 160).slice(0, 160);

	const x = optionalCoordinate(data.x, 'X', -30_000_000, 30_000_000);
	const y = optionalCoordinate(data.y, 'Y', -64, 320);
	const z = optionalCoordinate(data.z, 'Z', -30_000_000, 30_000_000);
	if ((x === null) !== (z === null) || ((x !== null || z !== null) && y === null)) {
		throw new InputError('Location needs X, Y and Z together — or leave all three empty.');
	}

	return { side, itemId, quantity, price, ign, guild, contact, world, x, y, z, note };
}

export interface OfferPatch {
	quantity?: number;
	price?: number;
	guild?: string;
	contact?: string;
	note?: string;
	x?: number | null;
	y?: number | null;
	z?: number | null;
	status?: 'open' | 'filled' | 'cancelled';
}

export function parseOfferPatch(body: unknown): OfferPatch {
	if (!body || typeof body !== 'object') throw new InputError('Expected a JSON object.');
	const data = body as Record<string, unknown>;
	const patch: OfferPatch = {};

	if (data.quantity !== undefined) patch.quantity = integer(data.quantity, 'Quantity', 1, 1_000_000);
	if (data.price !== undefined) {
		const raw = typeof data.price === 'string' ? Number(data.price) : data.price;
		if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new InputError('Price must be a number.');
		const price = Math.round(raw * 100) / 100;
		if (price <= 0) throw new InputError('Price must be greater than zero.');
		if (price > 1_000_000) throw new InputError('Price must be below 1,000,000.');
		patch.price = price;
	}
	if (data.guild !== undefined) patch.guild = text(data.guild, 32);
	if (data.contact !== undefined) patch.contact = text(data.contact, 64);
	if (data.note !== undefined) patch.note = text(data.note, 160);
	if (data.status !== undefined) {
		if (data.status !== 'open' && data.status !== 'filled' && data.status !== 'cancelled') {
			throw new InputError('Status must be open, filled or cancelled.');
		}
		patch.status = data.status;
	}

	const hasCoords = data.x !== undefined || data.y !== undefined || data.z !== undefined;
	if (hasCoords) {
		const x = optionalCoordinate(data.x, 'X', -30_000_000, 30_000_000);
		const y = optionalCoordinate(data.y, 'Y', -64, 320);
		const z = optionalCoordinate(data.z, 'Z', -30_000_000, 30_000_000);
		if ((x === null) !== (z === null) || ((x !== null || z !== null) && y === null)) {
			throw new InputError('Location needs X, Y and Z together — or clear all three.');
		}
		patch.x = x;
		patch.y = y;
		patch.z = z;
	}

	if (!Object.keys(patch).length) throw new InputError('Nothing to update.');
	return patch;
}
