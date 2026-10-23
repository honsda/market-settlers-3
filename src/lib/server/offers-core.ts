import type { Offer, OfferStatus, Side } from '../market';
import type { OfferRow } from './db';

export function toOffer(row: OfferRow): Offer {
	return {
		id: row.id,
		side: row.side,
		itemId: row.item_id,
		quantity: row.quantity,
		price: row.price,
		ign: row.ign,
		guild: row.guild ?? '',
		contact: row.contact ?? '',
		world: row.world ?? 'Caeldun',
		x: row.x,
		y: row.y,
		z: row.z,
		note: row.note ?? '',
		status: row.status,
		source: row.source,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface ListOptions {
	status?: OfferStatus | 'all';
	side?: Side;
	itemId?: string;
	ign?: string;
	guild?: string;
	limit?: number;
}

export interface PlayerSummary {
	ign: string;
	guild: string | null;
	openBuys: number;
	openSells: number;
	bidValue: number;
	askValue: number;
	lastSeen: number | null;
	forOffer: Offer | null;
}

export interface OfferCounts {
	offers24h: number;
	traders: number;
}

export function verifyToken(row: OfferRow, token: string | null | undefined): void {
	if (!token || token.length < 10 || token !== row.edit_token) {
		throw Object.assign(new Error('This offer is not yours to change. Missing or invalid edit token.'), {
			status: 403
		});
	}
}
