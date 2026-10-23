import type { Alert } from '../market';
import { usingSupabase } from './db';
import * as sqlite from './alerts-sqlite';
import * as supabaseBackend from './alerts-supabase';

export { toAlert, type AlertDisplay } from './alerts-core';

export async function listAlerts(limit = 12): Promise<Alert[]> {
	return usingSupabase ? supabaseBackend.listAlerts(limit) : sqlite.listAlerts(limit);
}

export async function getPendingAlerts(limit = 10): Promise<Alert[]> {
	return usingSupabase
		? supabaseBackend.getPendingAlerts(limit)
		: sqlite.getPendingAlerts(limit);
}

export async function markAlertPosted(
	id: string,
	discordMessageId: string | null
): Promise<void> {
	if (usingSupabase) {
		await supabaseBackend.markAlertPosted(id, discordMessageId);
		return;
	}
	sqlite.markAlertPosted(id, discordMessageId);
}
