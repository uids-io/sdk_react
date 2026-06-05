import { OAuthError } from "../errors.js";
import type { AuthApi } from "../http/auth-api.js";
import {
	type OAuthRedirectParams,
	parseOAuthRedirect,
} from "../oauth/parse-redirect.js";
import { mapTokenResponse } from "../oauth/token-mapper.js";
import type { DeviceStorage } from "../storage/device-storage.js";
import type { OAuthRedirectStorage } from "../storage/oauth-redirect-storage.js";
import type { AuthReactConfig, TokenSet } from "../types.js";
import type { SessionController } from "./session-controller.js";

/** In-tab exchange promise keyed by `clientId|code` (transaction-scoped). */
const redirectExchangePromises = new Map<string, Promise<TokenSet>>();

export interface ExchangeCallbackContext {
	config: AuthReactConfig;
	api: AuthApi;
	deviceStorage: DeviceStorage;
	redirectStorage: OAuthRedirectStorage;
	session: SessionController;
}

function toRedirectParams(
	urlOrParams: URLSearchParams | string | OAuthRedirectParams,
): OAuthRedirectParams {
	if (
		typeof urlOrParams === "string" ||
		urlOrParams instanceof URLSearchParams
	) {
		return parseOAuthRedirect(urlOrParams);
	}
	return urlOrParams;
}

function exchangeKey(clientId: string, code: string): string {
	return `${clientId}|${code}`;
}

export async function exchangeAuthorizationCode(
	ctx: ExchangeCallbackContext,
	urlOrParams: URLSearchParams | string | OAuthRedirectParams,
): Promise<TokenSet> {
	const { config, api, deviceStorage, redirectStorage, session } = ctx;
	const params = toRedirectParams(urlOrParams);

	if (params.error) {
		redirectStorage.markFailed();
		throw new OAuthError(
			params.error,
			params.error_description ?? params.error,
		);
	}

	const code = params.code;
	if (!code) {
		throw new OAuthError("invalid_request", "Missing authorization code");
	}

	const key = exchangeKey(config.clientId, code);
	const existingExchange = redirectExchangePromises.get(key);
	if (existingExchange) {
		return existingExchange;
	}

	const claim = redirectStorage.claimCallback({
		code,
		state: params.state,
	});

	if (claim.kind === "already_completed") {
		const tokens = session.getTokens();
		if (tokens) {
			return tokens;
		}
		redirectStorage.clear();
		throw new OAuthError(
			"invalid_request",
			"OAuth redirect already completed — restart sign-in",
		);
	}

	if (claim.kind === "await_claimed") {
		const inFlight = redirectExchangePromises.get(key);
		if (inFlight) {
			return inFlight;
		}
		throw new OAuthError(
			"invalid_request",
			"OAuth exchange in progress — restart sign-in if this persists",
		);
	}

	const verifier = claim.transaction.verifier;

	const exchange = (async () => {
		try {
			const deviceId = await deviceStorage.getDeviceId();
			const json = await api.exchangeCode({
				grant_type: "authorization_code",
				code,
				client_id: config.clientId,
				redirect_uri: config.redirectUri,
				code_verifier: verifier,
				deviceId,
			});

			redirectStorage.markCompleted();
			return session.applyTokens(mapTokenResponse(json), true);
		} catch (error) {
			redirectStorage.markFailed();
			throw error;
		} finally {
			redirectExchangePromises.delete(key);
		}
	})();

	redirectExchangePromises.set(key, exchange);
	return exchange;
}
