import { normalizeIssuer } from "../http/auth-api.js";
import { DEFAULT_SCOPE } from "../http/constants.js";
import type { PkcePair } from "../pkce.js";
import type { AuthorizeOptions, AuthReactConfig } from "../types.js";

export interface BuildAuthorizeUrlParams {
	config: AuthReactConfig;
	pkce: PkcePair;
	deviceId: string;
	state: string;
	options?: AuthorizeOptions;
}

export function buildAuthorizeUrl(params: BuildAuthorizeUrlParams): string {
	const { config, pkce, deviceId, state, options } = params;
	const url = new URL("/authorize", normalizeIssuer(config.issuer));
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", config.clientId);
	url.searchParams.set("redirect_uri", config.redirectUri);
	url.searchParams.set("scope", config.scope ?? DEFAULT_SCOPE);
	url.searchParams.set("code_challenge", pkce.challenge);
	url.searchParams.set("code_challenge_method", pkce.method);
	url.searchParams.set("device_id", deviceId);
	url.searchParams.set("platform", config.platform ?? "web");
	url.searchParams.set("state", options?.state ?? state);
	if (options?.nonce) {
		url.searchParams.set("nonce", options.nonce);
	}
	if (config.appVersion) {
		url.searchParams.set("app_version", config.appVersion);
	}
	if (options?.provider) {
		url.searchParams.set("login_provider", options.provider);
	}
	return url.toString();
}
