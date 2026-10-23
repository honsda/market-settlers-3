import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from './env';

export interface OfferRow {
	id: string;
	side: 'buy' | 'sell';
	item_id: string;
	quantity: number;
	price: number;
	ign: string;
	guild: string | null;
	contact: string | null;
	world: string | null;
	x: number | null;
	y: number | null;
	z: number | null;
	note: string | null;
	status: 'open' | 'filled' | 'cancelled';
	source: 'web' | 'discord' | 'seed';
	edit_token: string;
	created_at: number;
	updated_at: number;
}

export interface HistoryRow {
	id: number;
	item_id: string;
	bid: number | null;
	ask: number | null;
	ts: number;
}

export interface AlertRow {
	id: string;
	item_id: string;
	kind: 'price-up' | 'price-down' | 'new-high' | 'new-low';
	side: 'buy' | 'sell';
	price: number;
	previous: number | null;
	change_pct: number | null;
	message: string;
	created_at: number;
	posted_at: number | null;
	discord_message_id: string | null;
}

function openDatabase(): DatabaseSync {
	mkdirSync(dirname(serverEnv.dbPath), { recursive: true });
	const database = new DatabaseSync(serverEnv.dbPath);
	database.exec(`
		PRAGMA journal_mode = WAL;
		PRAGMA synchronous = NORMAL;
		PRAGMA busy_timeout = 5000;
		PRAGMA foreign_keys = ON;
	`);
	database.exec(`
		CREATE TABLE IF NOT EXISTS offers (
			id TEXT PRIMARY KEY,
			side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
			item_id TEXT NOT NULL,
			quantity INTEGER NOT NULL CHECK (quantity > 0),
			price REAL NOT NULL CHECK (price > 0),
			ign TEXT NOT NULL,
			guild TEXT,
			contact TEXT,
			world TEXT,
			x INTEGER,
			y INTEGER,
			z INTEGER,
			note TEXT,
			status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled')),
			source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'discord', 'seed')),
			edit_token TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_offers_open ON offers (status, item_id, side);
		CREATE INDEX IF NOT EXISTS idx_offers_created ON offers (created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_offers_ign ON offers (ign);

		CREATE TABLE IF NOT EXISTS price_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			item_id TEXT NOT NULL,
			bid REAL,
			ask REAL,
			ts INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_history_item_ts ON price_history (item_id, ts);

		CREATE TABLE IF NOT EXISTS alerts (
			id TEXT PRIMARY KEY,
			item_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			side TEXT NOT NULL,
			price REAL NOT NULL,
			previous REAL,
			change_pct REAL,
			message TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			posted_at INTEGER,
			discord_message_id TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts (created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_alerts_pending ON alerts (posted_at);

		CREATE TABLE IF NOT EXISTS meta (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`);
	database
		.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('revision', '1')`)
		.run();
	return database;
}

// Keep a single connection alive across dev-server hot reloads. The connection
// is opened lazily so a Supabase-only deployment never touches the filesystem.
const globalScope = globalThis as typeof globalThis & { __ms3Database?: DatabaseSync };

function database(): DatabaseSync {
	return (globalScope.__ms3Database ??= openDatabase());
}

export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
	get(_target, property) {
		const instance = database();
		const value = Reflect.get(instance, property);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});

const configuredSupabase = Boolean(serverEnv.supabaseUrl && serverEnv.supabaseSecretKey);
const requestedBackend = process.env.MARKET_BACKEND?.trim().toLowerCase();
export const usingSupabase = configuredSupabase && requestedBackend !== 'sqlite';

let supabaseClient: SupabaseClient | null = null;

/** Server-only Supabase client using the secret key (bypasses RLS). */
export function supabase(): SupabaseClient {
	if (!supabaseClient) {
		if (!configuredSupabase) {
			throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.');
		}
		supabaseClient = createClient(serverEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
			auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
		});
	}
	return supabaseClient;
}

export function assertOk(
	error: { message: string } | null,
	context: string
): void {
	if (error) throw new Error(`${context}: ${error.message}`);
}

export function newId(): string {
	return randomBytes(9).toString('base64url');
}

export function newEditToken(): string {
	return randomBytes(24).toString('base64url');
}

export function getRevisionSync(): number {
	const row = db.prepare(`SELECT value FROM meta WHERE key = 'revision'`).get() as
		| { value: string }
		| undefined;
	return Number(row?.value ?? 0);
}

export function bumpRevisionSync(): number {
	db.prepare(
		`UPDATE meta SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'revision'`
	).run();
	return getRevisionSync();
}

export function getMetaSync(key: string): string | null {
	const row = db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as
		| { value: string }
		| undefined;
	return row?.value ?? null;
}

export function setMetaSync(key: string, value: string | number | null): void {
	if (value === null) {
		db.prepare(`DELETE FROM meta WHERE key = ?`).run(key);
		return;
	}
	db.prepare(
		`INSERT INTO meta (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
	).run(key, String(value));
}

/** Async, backend-aware metadata helpers used by the web app and the bot. */
export async function getRevision(): Promise<number> {
	if (!usingSupabase) return getRevisionSync();
	const { data, error } = await supabase()
		.from('meta')
		.select('value')
		.eq('key', 'revision')
		.maybeSingle();
	assertOk(error, 'read revision');
	return Number(data?.value ?? 0);
}

export async function bumpRevision(): Promise<number> {
	if (!usingSupabase) return bumpRevisionSync();
	const { data, error } = await supabase().rpc('bump_revision');
	assertOk(error, 'bump revision');
	if (data !== null && data !== undefined) return Number(data);
	return getRevision();
}

export async function getMeta(key: string): Promise<string | null> {
	if (!usingSupabase) return getMetaSync(key);
	const { data, error } = await supabase()
		.from('meta')
		.select('value')
		.eq('key', key)
		.maybeSingle();
	assertOk(error, `read meta ${key}`);
	return data?.value ?? null;
}

export async function setMeta(key: string, value: string | number | null): Promise<void> {
	if (!usingSupabase) {
		setMetaSync(key, value);
		return;
	}
	if (value === null) {
		const { error } = await supabase().from('meta').delete().eq('key', key);
		assertOk(error, `delete meta ${key}`);
		return;
	}
	const { error } = await supabase()
		.from('meta')
		.upsert({ key, value: String(value) }, { onConflict: 'key' });
	assertOk(error, `write meta ${key}`);
}

export function transaction<T>(fn: () => T): T {
	db.exec('BEGIN IMMEDIATE');
	try {
		const result = fn();
		db.exec('COMMIT');
		return result;
	} catch (error) {
		try {
			db.exec('ROLLBACK');
		} catch {
			// Ignore rollback errors and surface the original failure.
		}
		throw error;
	}
}
