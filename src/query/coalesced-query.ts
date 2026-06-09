export interface CoalescedQueryOptions<TArg, TResult> {
	/** Returns a stable key for caching/coalescing. */
	key: (arg: TArg) => string;
	/** Executes the underlying fetch/load. */
	fetcher: (arg: TArg) => Promise<TResult>;
	/**
	 * Cache TTL in ms.
	 * - `undefined` means "cache forever" (until `clear()`).
	 * - `0` means "no cache" (still coalesces in-flight).
	 */
	ttlMs?: (arg: TArg) => number | undefined;
}

export interface CoalescedQuery<TArg, TResult> {
	query: (arg: TArg) => Promise<TResult>;
	clear: (keyPrefix?: string) => void;
}

/**
 * TanStack-like behavior for SDK internals:
 * - Coalesce concurrent callers for the same key (in-flight sharing)
 * - Optionally cache results with TTL
 *
 * This is intentionally small and dependency-free.
 */
export function createCoalescedQuery<TArg, TResult>(
	options: CoalescedQueryOptions<TArg, TResult>,
): CoalescedQuery<TArg, TResult> {
	const inflight = new Map<string, Promise<TResult>>();
	const cache = new Map<string, { expiresAt: number; data: TResult }>();

	function clear(keyPrefix?: string): void {
		if (!keyPrefix) {
			inflight.clear();
			cache.clear();
			return;
		}

		for (const key of inflight.keys()) {
			if (key.startsWith(keyPrefix)) inflight.delete(key);
		}

		for (const key of cache.keys()) {
			if (key.startsWith(keyPrefix)) cache.delete(key);
		}
	}

	async function query(arg: TArg): Promise<TResult> {
		const key = options.key(arg);
		const ttl = options.ttlMs?.(arg);
		const now = Date.now();

		if (ttl !== 0) {
			const hit = cache.get(key);
			if (hit && hit.expiresAt > now) {
				return hit.data;
			}
		}

		const existing = inflight.get(key);
		if (existing) {
			return existing;
		}

		const promise = options
			.fetcher(arg)
			.then((data) => {
				if (ttl !== 0) {
					cache.set(key, {
						data,
						expiresAt: ttl === undefined ? Number.POSITIVE_INFINITY : now + ttl,
					});
				}

				return data;
			})
			.finally(() => {
				inflight.delete(key);
			});

		inflight.set(key, promise);
		return promise;
	}

	return { query, clear };
}
