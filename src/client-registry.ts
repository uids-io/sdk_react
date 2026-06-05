import { type AuthClient, createAuthClient } from "./auth-client";
import { normalizeIssuer } from "./http/auth-api.js";
import type { AuthReactConfig } from "./types.js";

const clients = new Map<string, AuthClient>();

function registryKey(config: AuthReactConfig): string {
	return `${normalizeIssuer(config.issuer)}|${config.clientId}`;
}

/**
 * Returns a stable {@link AuthClient} for the portal config.
 * Survives React Strict Mode remounts when `config` is a module constant.
 */
export function getOrCreateAuthClient(config: AuthReactConfig): AuthClient {
	const key = registryKey(config);

	const existing = clients.get(key);
	if (existing) {
		return existing;
	}

	const client = createAuthClient(config);
	clients.set(key, client);

	return client;
}

/** Clears the client registry (tests). */
export function clearAuthClientRegistry(): void {
	clients.clear();
}
