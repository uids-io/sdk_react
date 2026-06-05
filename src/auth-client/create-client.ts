import { resolveTokenDelivery } from "../config/resolve-token-delivery.js";
import { OAuthError } from "../errors.js";
import { AuthApi } from "../http/auth-api.js";
import { mapDevice } from "../oauth/device-mapper.js";
import { fetchAuthProviders } from "../oauth/providers.js";
import { createTokenStorage } from "../storage/create-token-storage.js";
import { DeviceStorage } from "../storage/device-storage.js";
import { OAuthRedirectStorage } from "../storage/oauth-redirect-storage.js";
import { TabCoordinator } from "../sync/tab-coordinator.js";
import type {
	AuthProvidersResponse,
	AuthReactConfig,
	TokenSet,
} from "../types.js";
import { exchangeAuthorizationCode } from "./exchange-callback.js";
import { createSessionController } from "./session-controller.js";
import { startSignIn } from "./sign-in.js";
import type { AuthClient } from "./types.js";

/**
 * Creates an {@link AuthClient} for a single portal configuration.
 * Prefer {@link getOrCreateAuthClient} in React apps for a stable instance across remounts.
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

	const redirectStorage = new OAuthRedirectStorage(config.clientId);
	const tabCoordinator = new TabCoordinator(config.clientId);

	let providersCache: AuthProvidersResponse | null = null;
	let providersInflight: Promise<AuthProvidersResponse> | null = null;
	let bootstrapPromise: Promise<void> | undefined;
	let refreshInFlight: Promise<TokenSet> | null = null;

	const session = createSessionController({
		config,
		api,
		tokenStorage,
		deviceStorage,
		redirectStorage,
		tabCoordinator,
		refresh: () => client.refresh(),
	});

	const exchangeCtx = {
		config,
		api,
		deviceStorage,
		redirectStorage,
		session,
	};

	const signInCtx = {
		config,
		deviceStorage,
		redirectStorage,
		getProviders: () => client.getProviders(),
		registerDevice: () => client.registerDevice(),
	};

	const client: AuthClient = {
		async getProviders() {
			if (providersCache) {
				return providersCache;
			}
			if (!providersInflight) {
				providersInflight = fetchAuthProviders(config)
					.then((data) => {
						providersCache = data;
						return data;
					})
					.finally(() => {
						providersInflight = null;
					});
			}
			return providersInflight;
		},

		async loadProviders() {
			providersCache = await fetchAuthProviders(config);
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

		signIn(options) {
			return startSignIn(signInCtx, options);
		},

		handleCallback(urlOrParams) {
			return exchangeAuthorizationCode(exchangeCtx, urlOrParams);
		},

		async refresh() {
			if (!refreshInFlight) {
				refreshInFlight = tabCoordinator
					.withRefreshLock(async () => {
						const tokens = await session.executeRefresh();
						return session.applyTokens(tokens, true);
					})
					.finally(() => {
						refreshInFlight = null;
					});
			}
			return refreshInFlight;
		},

		async getAccessToken() {
			const tokens = session.getTokens();

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
			session.clearTokens(true);
			redirectStorage.clear();

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
			return session.onTokensChanged(cb);
		},

		initialize() {
			bootstrapPromise ??= session.initialize(() => client.refresh());
			return bootstrapPromise;
		},
	};

	return client;
}
