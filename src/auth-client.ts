/**
 * Framework-agnostic OAuth client for `@advcomm/uids-io-auth`.
 *
 * **Web (default):** access + ID token in memory; refresh token in HttpOnly cookie on the
 * auth issuer; multi-tab refresh coordinated via {@link TabCoordinator}.
 *
 * **Body fallback:** full token set in browser storage when `tokenDelivery: "body"` or
 * non-web platform — for Flutter web JSON parity and tests.
 *
 * @see docs/TOKEN_STORAGE.md
 * @see docs/ARCHITECTURE.md
 */

import { resolveTokenDelivery } from "./config/resolve-token-delivery.js";
import { isTokenReuseError, OAuthError } from "./errors.js";
import { AuthApi } from "./http/auth-api.js";
import { buildAuthorizeUrl } from "./oauth/authorize-url.js";
import { mapDevice } from "./oauth/device-mapper.js";
import { fetchAuthProviders, isProviderEnabled } from "./oauth/providers.js";
import { mapTokenResponse } from "./oauth/token-mapper.js";
import { generatePkcePair } from "./pkce.js";
import { createTokenStorage } from "./storage/create-token-storage.js";
import { DeviceStorage } from "./storage/device-storage.js";
import { PkceSessionStorage } from "./storage/pkce-storage.js";
import { TabCoordinator } from "./sync/tab-coordinator.js";
import type {
	AuthorizeOptions,
	AuthProvidersResponse,
	AuthReactConfig,
	Device,
	TokenSet,
} from "./types.js";

/**
 * OAuth + device client bound to one portal (`clientId` + `redirectUri`).
 */
export interface AuthClient {
	/** Login methods enabled on the auth server (Google, Microsoft, email). */
	getProviders(): Promise<AuthProvidersResponse>;
	getDeviceId(): Promise<string>;
	registerDevice(): Promise<void>;
	/**
	 * Starts PKCE login. Pass `{ provider: 'google' }` to skip the hosted provider chooser.
	 */
	signIn(options?: AuthorizeOptions): Promise<void>;
	handleCallback(urlOrParams: URLSearchParams | string): Promise<TokenSet>;
	refresh(): Promise<TokenSet>;
	getAccessToken(): Promise<string | null>;
	signOut(): Promise<void>;
	listDevices(): Promise<Device[]>;
	revokeDevice(deviceId: string): Promise<void>;
	onTokensChanged(cb: (tokens: TokenSet | null) => void): () => void;
	initialize(): Promise<void>;
}

function randomState(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toSearchParams(
	urlOrParams: URLSearchParams | string,
): URLSearchParams {
	if (typeof urlOrParams === "string") {
		return new URL(urlOrParams).searchParams;
	}
	return urlOrParams;
}

/**
 * Creates an {@link AuthClient} for a single portal configuration.
 */
export function createAuthClient(config: AuthReactConfig): AuthClient {
	const tokenDelivery = resolveTokenDelivery(config);
	const api = new AuthApi(config, tokenDelivery);
	const tokenStorage = createTokenStorage(
		config.clientId,
		tokenDelivery,
		config.tokenStorage,
	);
	const deviceStorage = new DeviceStorage(
		config.clientId,
		config.deviceStorage ?? "localStorage",
	);
	const pkceStorage = new PkceSessionStorage(config.clientId);
	const tabCoordinator = new TabCoordinator(config.clientId);

	const listeners = new Set<(tokens: TokenSet | null) => void>();
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;
	const skewSeconds = config.refreshSkewSeconds ?? 60;

	function notify(): void {
		const tokens = tokenStorage.get();
		for (const cb of listeners) {
			cb(tokens);
		}
	}

	function clearRefreshTimer(): void {
		if (refreshTimer !== null) {
			clearTimeout(refreshTimer);
			refreshTimer = null;
		}
	}

	function scheduleRefresh(tokens: TokenSet): void {
		clearRefreshTimer();
		if (!tokenStorage.canRefresh() && !tokens.accessToken) {
			return;
		}
		if (!tokenStorage.canRefresh()) {
			return;
		}
		const msUntilRefresh = Math.max(
			0,
			tokens.expiresAt - Date.now() - skewSeconds * 1000,
		);
		refreshTimer = setTimeout(() => {
			void client.refresh().catch(() => {
				/* listeners handle errors */
			});
		}, msUntilRefresh);
	}

	function applyTokensLocal(tokens: TokenSet, broadcast: boolean): TokenSet {
		tokenStorage.set(tokens);
		scheduleRefresh(tokens);
		notify();
		if (broadcast) {
			tabCoordinator.broadcast({
				type: "tokens-updated",
				tokens,
				clientId: config.clientId,
			});
		}
		return tokens;
	}

	function clearTokensLocal(broadcast: boolean): void {
		clearRefreshTimer();
		tokenStorage.clear();
		notify();
		if (broadcast) {
			tabCoordinator.broadcast({
				type: "session-cleared",
				clientId: config.clientId,
			});
		}
	}

	async function executeRefresh(): Promise<TokenSet> {
		if (!tokenStorage.canRefresh()) {
			throw new OAuthError("invalid_grant", "No refresh session");
		}
		const deviceId = await deviceStorage.getDeviceId();
		const refreshToken = tokenStorage.getRefreshTokenForBody();
		try {
			const json = await api.refresh(refreshToken, deviceId);
			return mapTokenResponse(json);
		} catch (error) {
			if (isTokenReuseError(error)) {
				clearTokensLocal(true);
				pkceStorage.clear();
			}
			throw error;
		}
	}

	tabCoordinator.subscribe((msg) => {
		if (msg.type === "tokens-updated") {
			applyTokensLocal(msg.tokens, false);
			return;
		}
		if (msg.type === "session-cleared") {
			clearRefreshTimer();
			tokenStorage.clear();
			notify();
		}
	});

	let providersCache: AuthProvidersResponse | null = null;

	const client: AuthClient = {
		async getProviders() {
			if (!providersCache) {
				providersCache = await fetchAuthProviders(config);
			}
			return providersCache;
		},

		async getDeviceId() {
			return deviceStorage.getDeviceId();
		},

		async registerDevice() {
			const deviceId = await deviceStorage.getDeviceId();
			await api.registerDevice({
				client_id: config.clientId,
				device_id: deviceId,
				platform: config.platform ?? "web",
				...(config.appVersion ? { app_version: config.appVersion } : {}),
			});
		},

		async signIn(options) {
			if (options?.provider) {
				const providers = await client.getProviders();
				if (!isProviderEnabled(providers, options.provider)) {
					throw new OAuthError(
						"provider_not_configured",
						`Login provider "${options.provider}" is not enabled on the auth server`,
					);
				}
			}

			await client.registerDevice();
			const deviceId = await deviceStorage.getDeviceId();
			const pkce = await generatePkcePair();
			const state = options?.state ?? randomState();
			pkceStorage.save(pkce.verifier, state);

			const url = buildAuthorizeUrl({
				config,
				pkce,
				deviceId,
				state,
				options,
			});

			window.location.assign(url);
		},

		async handleCallback(urlOrParams) {
			const params = toSearchParams(urlOrParams);
			const error = params.get("error");

			if (error) {
				throw new OAuthError(error, params.get("error_description") ?? error);
			}

			const code = params.get("code");
			if (!code) {
				throw new OAuthError("invalid_request", "Missing authorization code");
			}

			const returnedState = params.get("state");
			const expectedState = pkceStorage.getExpectedState();

			if (expectedState && returnedState !== expectedState) {
				throw new OAuthError("invalid_request", "Invalid OAuth state");
			}

			const verifier = pkceStorage.getVerifier();
			if (!verifier) {
				throw new OAuthError(
					"invalid_request",
					"Missing PKCE verifier — restart sign-in",
				);
			}

			const deviceId = await deviceStorage.getDeviceId();
			const json = await api.exchangeCode({
				grant_type: "authorization_code",
				code,
				client_id: config.clientId,
				redirect_uri: config.redirectUri,
				code_verifier: verifier,
				deviceId,
			});

			pkceStorage.clear();
			return applyTokensLocal(mapTokenResponse(json), true);
		},

		async refresh() {
			return tabCoordinator.withRefreshLock(async () => {
				const tokens = await executeRefresh();
				return applyTokensLocal(tokens, true);
			});
		},

		async getAccessToken() {
			const tokens = tokenStorage.get();
			if (!tokens) {
				if (!tokenStorage.canRefresh()) {
					return null;
				}
				try {
					const refreshed = await client.refresh();
					return refreshed.accessToken;
				} catch {
					return null;
				}
			}
			if (Date.now() < tokens.expiresAt - 5_000) {
				return tokens.accessToken;
			}
			try {
				const refreshed = await client.refresh();
				return refreshed.accessToken;
			} catch {
				return null;
			}
		},

		async signOut() {
			const refreshToken = tokenStorage.getRefreshTokenForBody();
			clearTokensLocal(true);
			pkceStorage.clear();
			try {
				await api.logout(refreshToken);
			} catch {
				/* local session cleared regardless */
			}
		},

		async listDevices() {
			const accessToken = await client.getAccessToken();
			if (!accessToken) {
				throw new OAuthError("unauthorized", "Not authenticated");
			}
			const { devices } = await api.listDevices(accessToken);
			return devices.map(mapDevice);
		},

		async revokeDevice(targetDeviceId) {
			const accessToken = await client.getAccessToken();
			if (!accessToken) {
				throw new OAuthError("unauthorized", "Not authenticated");
			}
			const deviceId = await deviceStorage.getDeviceId();
			await api.revokeDevice(accessToken, deviceId, targetDeviceId);
		},

		onTokensChanged(cb) {
			listeners.add(cb);
			cb(tokenStorage.get());
			return () => listeners.delete(cb);
		},

		async initialize() {
			const tokens = tokenStorage.get();
			if (tokens) {
				scheduleRefresh(tokens);
				return;
			}
			if (tokenStorage.canRefresh()) {
				try {
					await client.refresh();
				} catch {
					/* not logged in or refresh expired */
				}
			}
		},
	};

	return client;
}
