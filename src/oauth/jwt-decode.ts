import type { AuthUser } from "../types.js";

/**
 * Decodes a JWT payload without signature verification.
 *
 * **For display only** — API authorization must use server-side `requireAuth`.
 * @internal
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
	const parts = token.split(".");
	if (parts.length < 2) {
		return null;
	}
	const payload = parts[1];
	if (!payload) {
		return null;
	}
	try {
		const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
		const padded = base64.padEnd(
			base64.length + ((4 - (base64.length % 4)) % 4),
			"=",
		);
		const json = atob(padded);
		return JSON.parse(json) as Record<string, unknown>;
	} catch {
		return null;
	}
}

/**
 * Builds {@link AuthUser} from an OpenID Connect ID token for UI.
 *
 * Does not validate issuer, audience, or signature.
 *
 * @param idToken - JWT from token response
 * @returns User profile or `null` if token missing/invalid
 */
export function userFromIdToken(idToken?: string): AuthUser | null {
	if (!idToken) {
		return null;
	}
	const claims = decodeJwtPayload(idToken);
	if (!claims || typeof claims.sub !== "string") {
		return null;
	}
	return {
		sub: claims.sub,
		email: typeof claims.email === "string" ? claims.email : undefined,
		emailVerified:
			typeof claims.email_verified === "boolean"
				? claims.email_verified
				: undefined,
		name:
			typeof claims.name === "string"
				? claims.name
				: typeof claims.preferred_username === "string"
					? claims.preferred_username
					: undefined,
	};
}
