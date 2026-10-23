import { browser } from '$app/env';

export interface Profile {
	ign: string;
	guild: string;
	contact: string;
}

const PROFILE_KEY = 'ms3.profile.v1';
const TOKENS_KEY = 'ms3.offer-tokens.v1';

export const profile = $state<Profile>({ ign: '', guild: '', contact: '' });

/** Offer id -> edit token, kept locally so players can manage their posts. */
export const myOfferTokens = $state<Record<string, string>>({});

let loaded = false;

export function loadProfile(): void {
	if (!browser || loaded) return;
	loaded = true;
	try {
		const raw = localStorage.getItem(PROFILE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<Profile>;
			profile.ign = typeof parsed.ign === 'string' ? parsed.ign : '';
			profile.guild = typeof parsed.guild === 'string' ? parsed.guild : '';
			profile.contact = typeof parsed.contact === 'string' ? parsed.contact : '';
		}
		const tokens = localStorage.getItem(TOKENS_KEY);
		if (tokens) {
			const parsed = JSON.parse(tokens) as Record<string, unknown>;
			for (const [id, token] of Object.entries(parsed)) {
				if (typeof token === 'string') myOfferTokens[id] = token;
			}
		}
	} catch {
		// Corrupted local state should never block the dashboard.
	}
}

export function saveProfile(next: Profile): void {
	profile.ign = next.ign.trim().slice(0, 16);
	profile.guild = next.guild.trim().slice(0, 32);
	profile.contact = next.contact.trim().slice(0, 64);
	if (browser) {
		try {
			localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
		} catch {
			// storage can be unavailable in private mode
		}
	}
}

export function rememberOffer(id: string, token: string): void {
	myOfferTokens[id] = token;
	persistTokens();
}

export function forgetOffer(id: string): void {
	delete myOfferTokens[id];
	persistTokens();
}

export function tokenFor(id: string): string | undefined {
	return myOfferTokens[id];
}

function persistTokens(): void {
	if (!browser) return;
	try {
		localStorage.setItem(TOKENS_KEY, JSON.stringify(myOfferTokens));
	} catch {
		// ignore
	}
}
