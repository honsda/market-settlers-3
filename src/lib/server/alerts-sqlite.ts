import type { Alert } from '../market';
import { db, type AlertRow } from './db';
import { toAlert } from './alerts-core';

export function listAlerts(limit = 12): Alert[] {
	const rows = db
		.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?')
		.all(Math.min(Math.max(limit, 1), 100)) as unknown as AlertRow[];
	return rows.map(toAlert);
}

export function getPendingAlerts(limit = 10): Alert[] {
	const rows = db
		.prepare(
			`SELECT * FROM alerts WHERE posted_at IS NULL
			 ORDER BY created_at ASC LIMIT ?`
		)
		.all(Math.min(Math.max(limit, 1), 50)) as unknown as AlertRow[];
	return rows.map(toAlert);
}

export function markAlertPosted(id: string, discordMessageId: string | null): void {
	db.prepare('UPDATE alerts SET posted_at = ?, discord_message_id = ? WHERE id = ?').run(
		Date.now(),
		discordMessageId,
		id
	);
}
