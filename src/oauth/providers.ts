import { normalizeIssuer } from "../http/auth-api.js";
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

	const url = `${key}/.well-known/oauth-providers`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load auth providers (${response.status})`);
	}

	const data = (await response.json()) as AuthProvidersResponse;
	cached = { key, expiresAt: now + ttl, data };
	return data;
}

/** Clears in-memory provider cache (tests). */
export function clearAuthProvidersCache(): void {
	cached = null;
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
