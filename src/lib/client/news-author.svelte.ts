import { browser } from '$app/env';

const TOKEN_KEY = 'ms3.news-author-token.v1';

export const newsAuthor = $state({ token: '' });

let loaded = false;

function generateToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function loadNewsAuthor(): string {
	if (!browser) return '';
	if (!loaded) {
		loaded = true;
		try {
			newsAuthor.token = localStorage.getItem(TOKEN_KEY) ?? '';
		} catch {
			newsAuthor.token = '';
		}
		if (!newsAuthor.token) {
			newsAuthor.token = generateToken();
			try {
				localStorage.setItem(TOKEN_KEY, newsAuthor.token);
			} catch {
				// Private mode can block storage. The token still works for this page.
			}
		}
	}
	return newsAuthor.token;
}

export function newsAuthorHeaders(): Record<string, string> {
	const token = loadNewsAuthor();
	return token ? { 'x-news-author-token': token } : {};
}
