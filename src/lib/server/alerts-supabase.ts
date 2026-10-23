import type { Alert } from '../market';
import { assertOk, supabase, type AlertRow } from './db';
import { toAlert } from './alerts-core';

export async function listAlerts(limit = 12): Promise<Alert[]> {
	const { data, error } = await supabase()
		.from('alerts')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(Math.min(Math.max(limit, 1), 100));
	assertOk(error, 'list alerts');
	return ((data ?? []) as AlertRow[]).map(toAlert);
}

export async function getPendingAlerts(limit = 10): Promise<Alert[]> {
	const { data, error } = await supabase()
		.from('alerts')
		.select('*')
		.is('posted_at', null)
		.order('created_at', { ascending: true })
		.limit(Math.min(Math.max(limit, 1), 50));
	assertOk(error, 'read pending alerts');
	return ((data ?? []) as AlertRow[]).map(toAlert);
}

export async function markAlertPosted(id: string, discordMessageId: string | null): Promise<void> {
	const { error } = await supabase()
		.from('alerts')
		.update({ posted_at: Date.now(), discord_message_id: discordMessageId })
		.eq('id', id);
	assertOk(error, 'mark alert posted');
}
