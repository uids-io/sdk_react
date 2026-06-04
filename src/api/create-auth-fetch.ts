/**
 * Authenticated `fetch` helper for your **resource API** (not the auth server).
 *
 * Pairs with {@link AuthClient.getAccessToken} and {@link AuthClient.refresh}.
 */

/** Per-request options for the fetch returned by {@link createAuthFetch}. */
export interface AuthFetchOptions extends RequestInit {
	/**
	 * Invoked when the response is still 401 after one refresh attempt.
	 * Typical handler: `() => client.signIn()`.
	 */
	onUnauthorized?: () => void;
}

/** Default options applied to every request from the returned fetch function. */
export interface CreateAuthFetchDefaults extends RequestInit {
	/** Default {@link AuthFetchOptions.onUnauthorized} for all requests. */
	onUnauthorized?: () => void;
}

/** @see {@link createAuthFetch} */
export type GetAccessToken = () => Promise<string | null>;

/** @see {@link createAuthFetch} */
export type RefreshTokens = () => Promise<unknown>;

/**
 * Builds a `fetch` function that attaches `Authorization: Bearer` and handles 401.
 *
 * **Behavior:**
 * 1. Resolve access token via `getAccessToken()` (may refresh proactively inside the client).
 * 2. Perform the request.
 * 3. On **401**, call `refresh()` once (deduped if multiple requests fail in parallel).
 * 4. Retry the request with a new token.
 * 5. If still 401, call `onUnauthorized` (per-request or factory default).
 *
 * Does not throw on 401 — returns the final `Response` so callers can branch on `response.ok`.
 *
 * @param getAccessToken - Usually `() => client.getAccessToken()`
 * @param refresh - Usually `() => client.refresh()`
 * @param defaults - Shared `RequestInit` (base URL headers, `credentials`, etc.)
 * @example
 * ```ts
 * const apiFetch = createAuthFetch(
 *   () => client.getAccessToken(),
 *   () => client.refresh(),
 *   { onUnauthorized: () => client.signIn() },
 * );
 * const res = await apiFetch("https://api.example.com/me");
 * ```
 */
export function createAuthFetch(
	getAccessToken: GetAccessToken,
	refresh: RefreshTokens,
	defaults: CreateAuthFetchDefaults = {},
): (input: RequestInfo | URL, init?: AuthFetchOptions) => Promise<Response> {
	let refreshInFlight: Promise<unknown> | null = null;
	const { onUnauthorized: defaultOnUnauthorized, ...fetchDefaults } = defaults;

	async function getTokenWithRefresh(
		forceRefresh: boolean,
	): Promise<string | null> {
		if (forceRefresh) {
			if (!refreshInFlight) {
				refreshInFlight = refresh().finally(() => {
					refreshInFlight = null;
				});
			}
			await refreshInFlight;
		}
		return getAccessToken();
	}

	return async (input, init = {}) => {
		const { onUnauthorized, ...requestInit } = init;

		const run = async (forceRefresh: boolean) => {
			const token = await getTokenWithRefresh(forceRefresh);
			const headers = new Headers(fetchDefaults.headers);
			if (requestInit.headers) {
				const extra = new Headers(requestInit.headers);
				extra.forEach((value, key) => {
					headers.set(key, value);
				});
			}
			if (token) {
				headers.set("Authorization", `Bearer ${token}`);
			}
			return fetch(input, { ...fetchDefaults, ...requestInit, headers });
		};

		let response = await run(false);
		if (response.status === 401) {
			response = await run(true);
			if (response.status === 401) {
				(onUnauthorized ?? defaultOnUnauthorized)?.();
			}
		}
		return response;
	};
}
