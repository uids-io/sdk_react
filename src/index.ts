/**
 * @uids-io/auth-react — Browser/React OAuth client for `@advcomm/uids-io-auth`.
 *
 * **Main entry points:**
 * - {@link createAuthClient} — PKCE login, tokens, refresh, logout
 * - {@link AuthProvider} / {@link useAuth} — React session state
 * - {@link createAuthFetch} — Bearer `fetch` for your API
 *
 * **Guides:** [README](../README.md) · [Architecture](../docs/ARCHITECTURE.md)
 *
 * @packageDocumentation
 */

export {
	type AuthFetchOptions,
	type CreateAuthFetchDefaults,
	createAuthFetch,
} from "./api/create-auth-fetch.js";
export { type AuthClient, createAuthClient } from "./auth-client.js";
export { resolveTokenDelivery } from "./config/resolve-token-delivery.js";
export {
	AuthSdkError,
	isOAuthError,
	isTokenReuseError,
	OAuthError,
	TokenReuseError,
	ValidationError,
} from "./errors.js";
export {
	DEFAULT_SCOPE,
	DEVICE_ID_HEADER,
	TOKEN_DELIVERY_COOKIE,
	TOKEN_DELIVERY_HEADER,
} from "./http/constants.js";
export { buildAuthorizeUrl } from "./oauth/authorize-url.js";
export {
	buildAuthReactConfigFromDiscovery,
	fetchOpenIdConfiguration,
	resolveAuthConfigFromDiscovery,
	scopeFromDiscovery,
	type AuthReactConfigPortalOptions,
	type OpenIdConfiguration,
} from "./oauth/openid-discovery.js";
export {
	clearAuthProvidersCache,
	fetchAuthProviders,
	getEnabledProviders,
	isProviderEnabled,
} from "./oauth/providers.js";
export { generateCodeVerifier, generatePkcePair } from "./pkce.js";
export { AuthProvider, type AuthProviderProps } from "./react/auth-provider.js";
export { useAuth } from "./react/use-auth.js";
export { useRequireAuth } from "./react/use-require-auth.js";
export type {
	AuthorizeOptions,
	AuthProvidersResponse,
	AuthReactConfig,
	AuthUser,
	Device,
	DevicePlatform,
	LoginProviderId,
	LoginProviderInfo,
	TokenDeliveryMode,
	TokenSet,
} from "./types.js";
