import { normalizeIssuer } from "../http/auth-api.js";
import { coalescedFetch } from "../http/coalesced-fetch.js";
import { DEFAULT_SCOPE, OPENID_CONFIGURATION_PATH } from "../http/constants.js";
import { createCoalescedQuery } from "../query/coalesced-query.js";
import type { AuthReactConfig } from "../types.js";

/** OIDC discovery document (`GET …/.well-known/openid-configuration`). */
export interface OpenIdConfiguration {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	jwks_uri?: string;
	scopes_supported?: string[];
	response_types_supported?: string[];
	grant_types_supported?: string[];
	code_challenge_methods_supported?: string[];
}

const DEFAULT_SCOPE_ORDER = ["openid", "profile", "email"] as const;

function assertDiscovery(data: unknown): OpenIdConfiguration {
	if (!data || typeof data !== "object") {
		throw new Error("OpenID configuration response is not an object");
	}

	const doc = data as Record<string, unknown>;
	for (const key of ["issuer", "authorization_endpoint", "token_endpoint"]) {
		if (typeof doc[key] !== "string" || !doc[key]) {
			throw new Error(`OpenID configuration missing or invalid "${key}"`);
		}
	}

	return data as OpenIdConfiguration;
}

const openIdConfigurationQuery = createCoalescedQuery<
	string,
	OpenIdConfiguration
>({
	key: (url) => url,
	ttlMs: () => undefined, // cache forever (until clear)
	fetcher: async (url) => assertDiscovery(await coalescedFetch<unknown>(url)),
});

/**
 * Builds the OIDC discovery URL from the auth issuer base URL.
 * `baseUrl` must already include any mount path (e.g. `https://api.example.com/auth`).
 */
export function openIdDiscoveryUrl(baseUrl: string): string {
	return `${normalizeIssuer(baseUrl)}${OPENID_CONFIGURATION_PATH}`;
}

/**
 * Fetches the OIDC discovery document from the auth server public path.
 * @param discoveryUrl - Full URL, or use {@link openIdDiscoveryUrl} with a base URL
 */
export async function fetchOpenIdConfiguration(
	discoveryUrl: string,
): Promise<OpenIdConfiguration> {
	return openIdConfigurationQuery.query(discoveryUrl);
}

/** Clears in-memory discovery cache (tests). */
export function clearOpenIdDiscoveryCache(): void {
	openIdConfigurationQuery.clear();
}

/** Builds default OAuth scope from discovery `scopes_supported`. */
export function scopeFromDiscovery(discovery: OpenIdConfiguration): string {
	const supported = discovery.scopes_supported;
	if (!supported?.length) {
		return DEFAULT_SCOPE;
	}
	const picked = DEFAULT_SCOPE_ORDER.filter((s) => supported.includes(s));
	return picked.length > 0 ? picked.join(" ") : DEFAULT_SCOPE;
}

/** Portal fields that are not in the discovery document. */
export interface AuthReactConfigPortalOptions {
	clientId: string;
	redirectUri: string;
	platform?: AuthReactConfig["platform"];
	appVersion?: string;
	apiAudience?: string;
	tokenDelivery?: AuthReactConfig["tokenDelivery"];
	tokenStorage?: AuthReactConfig["tokenStorage"];
	refreshSkewSeconds?: number;
	providersCacheTtlMs?: number;
}

/**
 * Merges OIDC discovery with portal-specific OAuth client settings.
 * Uses `discovery.issuer` as {@link AuthReactConfig.issuer}.
 */
export function buildAuthReactConfigFromDiscovery(
	discovery: OpenIdConfiguration,
	portal: AuthReactConfigPortalOptions,
): AuthReactConfig {
	return {
		issuer: discovery.issuer.replace(/\/+$/, ""),
		clientId: portal.clientId,
		redirectUri: portal.redirectUri,
		scope: scopeFromDiscovery(discovery),
		platform: portal.platform ?? "web",
		...(portal.appVersion ? { appVersion: portal.appVersion } : {}),
		...(portal.apiAudience ? { apiAudience: portal.apiAudience } : {}),
		...(portal.tokenDelivery ? { tokenDelivery: portal.tokenDelivery } : {}),
		...(portal.tokenStorage ? { tokenStorage: portal.tokenStorage } : {}),
		...(portal.refreshSkewSeconds !== undefined
			? { refreshSkewSeconds: portal.refreshSkewSeconds }
			: {}),
		...(portal.providersCacheTtlMs !== undefined
			? { providersCacheTtlMs: portal.providersCacheTtlMs }
			: {}),
	};
}

/**
 * Loads discovery and returns a ready {@link AuthReactConfig}.
 */
export async function resolveAuthConfigFromDiscovery(
	discoveryUrl: string,
	portal: AuthReactConfigPortalOptions,
): Promise<AuthReactConfig> {
	const discovery = await fetchOpenIdConfiguration(discoveryUrl);
	return buildAuthReactConfigFromDiscovery(discovery, portal);
}

/**
 * Resolves {@link AuthReactConfig} from issuer base URL + portal client settings.
 * Fetches `{baseUrl}/.well-known/openid-configuration`.
 */
export async function resolveAuthConfigFromBaseUrl(
	baseUrl: string,
	portal: AuthReactConfigPortalOptions,
): Promise<AuthReactConfig> {
	return resolveAuthConfigFromDiscovery(openIdDiscoveryUrl(baseUrl), portal);
}
