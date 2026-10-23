import type { Alert, Side } from '../market';
import type { AlertRow } from './db';

export function toAlert(row: AlertRow): Alert {
	return {
		id: row.id,
		itemId: row.item_id,
		kind: row.kind,
		side: row.side,
		price: row.price,
		previous: row.previous,
		changePct: row.change_pct,
		message: row.message,
		createdAt: row.created_at,
		postedAt: row.posted_at
	};
}

export interface AlertDisplay {
	kind: Alert['kind'];
	side: Side;
	color: number;
	emoji: string;
	title: string;
}
