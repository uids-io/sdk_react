/**
 * Shared configuration and data types for `@uids-io/auth-react`.
 *
 * @packageDocumentation
 */

/** Client platform sent to the auth server on device register and authorize. */
export type DevicePlatform = "web" | "ios" | "android" | "desktop" | "unknown";

/** How the refresh token is stored and sent to `/refresh`. */
export type TokenDeliveryMode = "cookie" | "body";

/** Login methods exposed by the auth server (`GET /.well-known/oauth-providers`). */
export type LoginProviderId = "google" | "microsoft" | "email";

export interface LoginProviderInfo {
	id: LoginProviderId;
	enabled: boolean;
}

/** Response from `GET {issuer}/.well-known/oauth-providers`. */
export interface AuthProvidersResponse {
	issuer: string;
	providers: LoginProviderInfo[];
}

/**
 * Portal-specific OAuth client configuration.
 *
 * Create one config object per React app build (merchant, agency, etc.).
 * Keep the object referentially stable when passed to `AuthProvider`.
 */
export interface AuthReactConfig {
	/**
	 * Base URL of the auth server running `@advcomm/uids-io-auth`
	 * (`createAuthRouter`). **Not** your business API URL.
	 * @example `"https://auth.example.com"` or `"http://localhost:3000"`
	 */
	issuer: string;

	/**
	 * OAuth 2.0 public client identifier for this portal only.
	 * Must match a row registered via `OAuthClientService.upsertPublicClient`.
	 * @example `"merchant_portal_web"`
	 */
	clientId: string;

	/**
	 * Redirect URI for this portal's OAuth callback route.
	 * Must exactly match one of the client's `allowedRedirectUris`.
	 * @example `"https://merchant.example.com/auth/callback"`
	 */
	redirectUri: string;

	/**
	 * Device platform reported to the auth server.
	 * @default `"web"`
	 */
	platform?: DevicePlatform;

	/** Optional build/version string stored on device registration. */
	appVersion?: string;

	/**
	 * Space-separated OAuth scopes for `/authorize`.
	 * @default `"openid profile email"`
	 */
	scope?: string;

	/**
	 * Where the SDK persists the generated `device_id` UUID.
	 * @default `"localStorage"`
	 */
	deviceStorage?: "localStorage" | "indexedDB";

	/**
	 * How refresh tokens reach the client. See `docs/TOKEN_STORAGE.md`.
	 *
	 * - `"auto"` (default) — `"cookie"` in browser with `platform: "web"`, else `"body"`
	 * - `"cookie"` — RT in HttpOnly cookie on auth issuer; AT/ID in memory (recommended web)
	 * - `"body"` — RT in JSON + `tokenStorage` browser persistence (Flutter web, tests)
	 *
	 * @default `"auto"`
	 */
	tokenDelivery?: "auto" | "cookie" | "body";

	/**
	 * Browser persistence when `tokenDelivery` is `"body"`.
	 * Ignored for `"cookie"` mode (access token stays in memory only).
	 * @default `"sessionStorage"`
	 */
	tokenStorage?: "memory" | "sessionStorage" | "localStorage";

	/**
	 * Expected `aud` claim when validating ID tokens client-side (display only).
	 * API servers enforce audience via `requireAuth`; this field does not affect HTTP calls.
	 */
	apiAudience?: string;

	/**
	 * Proactively call `refresh()` this many seconds before `expiresAt`.
	 * @default `60`
	 */
	refreshSkewSeconds?: number;

	/**
	 * Cache duration for `GET /.well-known/oauth-providers` (ms).
	 * @default `300000` (5 minutes)
	 */
	providersCacheTtlMs?: number;
}

/**
 * Normalized OAuth token response stored by the client after login or refresh.
 */
export interface TokenSet {
	/** JWT access token for `Authorization: Bearer` on API requests. */
	accessToken: string;

	/**
	 * Opaque refresh token — only present in memory when `tokenDelivery: "body"`.
	 * In cookie mode the RT is HttpOnly on the auth server (not exposed to JS).
	 */
	refreshToken?: string;

	/** Always `"Bearer"` for this server. */
	tokenType: "Bearer";

	/** Server `expires_in` (seconds) from the last token response. */
	expiresIn: number;

	/** Unix timestamp in milliseconds when `accessToken` expires. */
	expiresAt: number;

	/** Granted scope string, if returned by the server. */
	scope?: string;

	/**
	 * OpenID Connect ID token (JWT).
	 * Used by `useAuth().user` for display — not verified in the browser.
	 */
	idToken?: string;
}

/**
 * User profile derived from ID token claims for UI.
 * Not a substitute for server-side authentication checks.
 */
export interface AuthUser {
	/** Subject (`sub` claim). */
	sub: string;
	email?: string;
	emailVerified?: boolean;
	name?: string;
}

/**
 * Device record returned from `GET /devices` (camelCase JSON from auth server).
 */
export interface Device {
	deviceId: string;
	clientId: string;
	platform: DevicePlatform;
	platformVersion: string | null;
	appVersion: string | null;
	deviceName: string | null;
	status: string;
	lastSeenAt: string;
}

/**
 * Optional parameters for {@link AuthClient.signIn}.
 */
export interface AuthorizeOptions {
	/**
	 * OAuth `state` parameter for CSRF protection.
	 * If omitted, the SDK generates a random value and validates it on callback.
	 */
	state?: string;

	/** OpenID Connect `nonce` for ID token binding (passed to `/authorize`). */
	nonce?: string;

	/**
	 * Skip hosted login chooser and go directly to this provider.
	 * Must be enabled on the auth server (`useAuth().providers` or `getProviders()`).
	 *
	 * - `"google"` / `"microsoft"` → IdP OAuth on auth server
	 * - `"email"` → auth server email/password login page
	 * - omitted → auth server `/login` shows all enabled providers
	 */
	provider?: LoginProviderId;
}

/** Raw token response body from `POST /token` and `POST /refresh`. @internal */
export interface TokenResponseJson {
	access_token: string;
	token_type: "Bearer";
	expires_in: number;
	refresh_token?: string;
	id_token?: string;
	scope?: string;
}

/** Raw device JSON from auth server list/register endpoints. @internal */
export interface DeviceJson {
	deviceId: string;
	clientId: string;
	platform: DevicePlatform;
	platformVersion: string | null;
	appVersion: string | null;
	deviceName: string | null;
	status: string;
	lastSeenAt: string;
}
