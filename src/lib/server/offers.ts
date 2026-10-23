import type { Offer } from '../market';
import { usingSupabase } from './db';
import * as sqlite from './offers-sqlite';
import * as supabaseBackend from './offers-supabase';
import type { ListOptions, OfferCounts, PlayerSummary } from './offers-core';
import type { OfferInput, OfferPatch } from './validation';

export { toOffer, type ListOptions, type OfferCounts, type PlayerSummary } from './offers-core';

export async function listOffers(options: ListOptions = {}): Promise<Offer[]> {
	return usingSupabase ? supabaseBackend.listOffers(options) : sqlite.listOffers(options);
}

export async function getOffer(id: string): Promise<Offer | undefined> {
	return usingSupabase ? supabaseBackend.getOffer(id) : sqlite.getOffer(id);
}

export async function createOffer(
	input: OfferInput,
	options: { source?: 'web' | 'discord' | 'seed'; ign?: string } = {}
): Promise<{ offer: Offer; editToken: string }> {
	return usingSupabase
		? supabaseBackend.createOffer(input, options)
		: sqlite.createOffer(input, options);
}

export async function updateOffer(
	id: string,
	patch: OfferPatch,
	token: string | null | undefined
): Promise<Offer> {
	return usingSupabase
		? supabaseBackend.updateOffer(id, patch, token)
		: sqlite.updateOffer(id, patch, token);
}

export async function cancelOffer(
	id: string,
	token: string | null | undefined,
	status: 'cancelled' | 'filled' = 'cancelled'
): Promise<Offer> {
	return usingSupabase
		? supabaseBackend.cancelOffer(id, token, status)
		: sqlite.cancelOffer(id, token, status);
}

export async function countOpenOffersForIgn(ign: string): Promise<number> {
	return usingSupabase
		? supabaseBackend.countOpenOffersForIgn(ign)
		: sqlite.countOpenOffersForIgn(ign);
}

export async function getGuilds(limit = 24): Promise<string[]> {
	return usingSupabase ? supabaseBackend.getGuilds(limit) : sqlite.getGuilds(limit);
}

export async function getPlayerSummary(ign: string): Promise<PlayerSummary> {
	return usingSupabase
		? supabaseBackend.getPlayerSummary(ign)
		: sqlite.getPlayerSummary(ign);
}

export async function getOfferCounts(): Promise<OfferCounts> {
	return usingSupabase ? supabaseBackend.getOfferCounts() : sqlite.getOfferCounts();
}

export async function hasSeedOffers(): Promise<boolean> {
	return usingSupabase ? supabaseBackend.hasSeedOffers() : sqlite.hasSeedOffers();
}
