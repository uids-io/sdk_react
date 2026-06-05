import { isTokenReuseError, OAuthError } from "../errors.js";
import type { AuthApi } from "../http/auth-api.js";
import { mapTokenResponse } from "../oauth/token-mapper.js";
import type { ITokenStorage } from "../storage/create-token-storage.js";
import type { DeviceStorage } from "../storage/device-storage.js";
import type { OAuthRedirectStorage } from "../storage/oauth-redirect-storage.js";
import type { TabCoordinator } from "../sync/tab-coordinator.js";
import type { AuthReactConfig, TokenSet } from "../types.js";

export interface SessionController {
	applyTokens(tokens: TokenSet, broadcast: boolean): TokenSet;
	clearTokens(broadcast: boolean): void;
	executeRefresh(): Promise<TokenSet>;
	scheduleRefresh(tokens: TokenSet): void;
	getTokens(): TokenSet | null;
	onTokensChanged(cb: (tokens: TokenSet | null) => void): () => void;
	initialize(refresh: () => Promise<TokenSet>): Promise<void>;
}

interface SessionControllerDeps {
	config: AuthReactConfig;
	api: AuthApi;
	tokenStorage: ITokenStorage;
	deviceStorage: DeviceStorage;
	redirectStorage: OAuthRedirectStorage;
	tabCoordinator: TabCoordinator;
	refresh: () => Promise<TokenSet>;
}

export function createSessionController(
	deps: SessionControllerDeps,
): SessionController {
	const {
		config,
		api,
		tokenStorage,
		deviceStorage,
		redirectStorage,
		tabCoordinator,
	} = deps;

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
			void deps.refresh().catch(() => {
				/* listeners handle errors */
			});
		}, msUntilRefresh);
	}

	function applyTokens(tokens: TokenSet, broadcast: boolean): TokenSet {
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

	function clearTokens(broadcast: boolean): void {
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
				clearTokens(true);
				redirectStorage.clear();
			}
			throw error;
		}
	}

	tabCoordinator.subscribe((msg) => {
		if (msg.type === "session-request") {
			const tokens = tokenStorage.get();

			if (tokens?.accessToken) {
				tabCoordinator.broadcast({
					type: "tokens-updated",
					tokens,
					clientId: config.clientId,
				});
			}

			return;
		}

		if (msg.type === "tokens-updated") {
			applyTokens(msg.tokens, false);
			return;
		}

		if (msg.type === "session-cleared") {
			clearRefreshTimer();
			tokenStorage.clear();
			notify();
		}
	});

	return {
		applyTokens,
		clearTokens,
		executeRefresh,
		scheduleRefresh,
		getTokens: () => tokenStorage.get(),
		onTokensChanged(cb) {
			listeners.add(cb);
			cb(tokenStorage.get());
			return () => listeners.delete(cb);
		},
		async initialize(refresh) {
			const tokens = tokenStorage.get();
			if (tokens) {
				scheduleRefresh(tokens);
				return;
			}

			const fromOtherTab = await tabCoordinator.requestTokensFromOtherTabs();
			if (fromOtherTab) {
				applyTokens(fromOtherTab, false);
				return;
			}

			if (tokenStorage.canRefresh()) {
				try {
					await refresh();
				} catch {
					/* not logged in or refresh expired */
				}
			}
		},
	};
}
