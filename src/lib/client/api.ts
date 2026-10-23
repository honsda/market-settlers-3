export async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, {
		...init,
		headers: { accept: 'application/json', ...(init?.headers ?? {}) }
	});
	if (!response.ok) {
		const data = await response.json().catch(() => null);
		throw new Error(
			(data as { error?: string } | null)?.error ?? `Request failed (${response.status})`
		);
	}
	return (await response.json()) as T;
}

export async function sendJSON<T>(
	url: string,
	method: 'POST' | 'PATCH' | 'DELETE',
	body?: unknown,
	editToken?: string
): Promise<T> {
	const response = await fetch(url, {
		method,
		headers: {
			'content-type': 'application/json',
			accept: 'application/json',
			...(editToken ? { 'x-edit-token': editToken } : {})
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error((data as { error?: string } | null)?.error ?? `Request failed (${response.status})`);
	}
	return data as T;
}
