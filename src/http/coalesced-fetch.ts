const inflight = new Map<string, Promise<unknown>>();

function methodKey(method: string | undefined): string {
	return (method ?? "GET").toUpperCase();
}

/**
 * Coalesces identical in-flight requests (dedupes concurrent callers).
 *
 * Policy:
 * - Default `GET` requests are coalesced by `METHOD:URL`.
 * - Non-GET requests are NOT coalesced (side-effecting / token-rotation safety).
 */
export async function coalescedFetch<T>(
	url: string,
	init?: RequestInit,
): Promise<T> {
	const method = methodKey(init?.method);
	if (method !== "GET") {
		const response = await fetch(url, init);
		if (!response.ok) {
			throw new Error(`Request failed (${response.status}) for ${url}`);
		}
		return (await response.json()) as T;
	}

	const key = `${method}:${url}`;
	const existing = inflight.get(key) as Promise<T> | undefined;
	if (existing) {
		return existing;
	}

	const promise = (async () => {
		const response = await fetch(url, init);
		if (!response.ok) {
			throw new Error(`Request failed (${response.status}) for ${url}`);
		}
		return (await response.json()) as T;
	})().finally(() => {
		inflight.delete(key);
	});

	inflight.set(key, promise);
	return promise;
}

/** Clears in-flight coalescing (tests). */
export function clearCoalescedFetch(): void {
	inflight.clear();
}
