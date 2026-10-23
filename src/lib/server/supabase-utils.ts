import { assertOk } from './db';

interface PageResult<T> {
	data: T[] | null;
	error: { message: string } | null;
}

/**
 * Supabase/PostgREST caps a single response at 1,000 rows by default. Walk
 * pages until the result set is exhausted.
 */
export async function fetchAllRows<T>(
	page: (from: number, to: number) => PromiseLike<PageResult<T>>,
	context: string,
	pageSize = 1000
): Promise<T[]> {
	const rows: T[] = [];
	for (let from = 0; ; from += pageSize) {
		const { data, error } = await page(from, from + pageSize - 1);
		assertOk(error, context);
		if (!data?.length) break;
		rows.push(...data);
		if (data.length < pageSize) break;
	}
	return rows;
}
