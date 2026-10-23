/**
 * Small in-memory sliding window limiter. Good enough for a community market;
 * swap for Redis if you run more than one web instance.
 */
const buckets = new Map<string, number[]>();
const MAX_KEYS = 5000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();
	const hits = (buckets.get(key) ?? []).filter((ts) => now - ts < windowMs);
	if (hits.length >= limit) {
		buckets.set(key, hits);
		return false;
	}
	hits.push(now);
	buckets.set(key, hits);

	if (buckets.size > MAX_KEYS) {
		for (const [bucketKey, timestamps] of buckets) {
			if (!timestamps.length || now - timestamps[timestamps.length - 1] > windowMs) {
				buckets.delete(bucketKey);
			}
		}
	}
	return true;
}
