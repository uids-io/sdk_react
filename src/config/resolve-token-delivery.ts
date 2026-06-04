import type { AuthReactConfig, TokenDeliveryMode } from "../types.js";

/**
 * Resolves how refresh tokens are delivered/stored.
 *
 * - **cookie** — browser `platform: web` (default): HttpOnly cookie on auth server
 * - **body** — JSON `refresh_token` in storage (SSR tests, non-web, or `tokenDelivery: "body"`)
 */
export function resolveTokenDelivery(
	config: AuthReactConfig,
): TokenDeliveryMode {
	if (config.tokenDelivery === "cookie" || config.tokenDelivery === "body") {
		return config.tokenDelivery;
	}
	const platform = config.platform ?? "web";
	const isBrowser =
		typeof globalThis !== "undefined" &&
		typeof (globalThis as { window?: unknown }).window !== "undefined";
	if (config.tokenDelivery === "auto" || config.tokenDelivery === undefined) {
		if (isBrowser && platform === "web") {
			return "cookie";
		}
		return "body";
	}
	return "body";
}
