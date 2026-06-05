import { normalizeIssuer } from "../http/auth-api.js";
import { coalescedFetch } from "../http/coalesced-fetch.js";
import { createCoalescedQuery } from "../query/coalesced-query.js";
import type {
	AuthProvidersResponse,
	AuthReactConfig,
	LoginProviderId,
} from "../types.js";

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

let cached: {
	key: string;
	expiresAt: number;
	data: AuthProvidersResponse;
} | null = null;

const providersQuery = createCoalescedQuery<
	AuthReactConfig,
	AuthProvidersResponse
>({
	key: (config) => normalizeIssuer(config.issuer),
	ttlMs: (config) => config.providersCacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
	fetcher: async (config) => {
		const base = normalizeIssuer(config.issuer);
		const url = `${base}/.well-known/oauth-providers`;
		const data = await coalescedFetch<AuthProvidersResponse>(url);
		if (!data || typeof data !== "object") {
			throw new Error("Invalid auth providers response");
		}
		return data;
	},
});

function cacheKey(config: AuthReactConfig): string {
	return normalizeIssuer(config.issuer);
}

/**
 * Fetches enabled login providers from the auth server.
 * Result is cached per issuer for {@link AuthReactConfig.providersCacheTtlMs}.
 */
export async function fetchAuthProviders(
	config: AuthReactConfig,
): Promise<AuthProvidersResponse> {
	const key = cacheKey(config);
	const ttl = config.providersCacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
	const now = Date.now();

	if (cached && cached.key === key && cached.expiresAt > now) {
		return cached.data;
	}

	const data = await providersQuery.query(config);
	cached = { key, expiresAt: Date.now() + ttl, data };
	return data;
}

/** Clears in-memory provider cache (tests). */
export function clearAuthProvidersCache(): void {
	cached = null;
	providersQuery.clear();
}

export function isProviderEnabled(
	providers: AuthProvidersResponse,
	id: LoginProviderId,
): boolean {
	return providers.providers.find((p) => p.id === id)?.enabled ?? false;
}

export function getEnabledProviders(
	providers: AuthProvidersResponse,
): LoginProviderId[] {
	return providers.providers.filter((p) => p.enabled).map((p) => p.id);
}
