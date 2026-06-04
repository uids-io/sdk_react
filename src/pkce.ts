/**
 * PKCE helpers using the Web Crypto API (browser-safe; no Node `crypto`).
 *
 * Used internally by {@link AuthClient.signIn}. Exported for tests and advanced integrations.
 */

/** PKCE material for S256 authorization code flow. */
export interface PkcePair {
	/** Secret sent to `POST /token` (stored in `sessionStorage` until callback). */
	verifier: string;
	/** Derived challenge sent to `/authorize`. */
	challenge: string;
	/** Always `"S256"` for this auth server. */
	method: "S256";
}

function base64UrlEncode(bytes: Uint8Array): string {
	const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/**
 * Generates a high-entropy code verifier (32 bytes, base64url).
 * Matches the server implementation in `@advcomm/uids-io-auth`.
 */
export function generateCodeVerifier(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return base64UrlEncode(bytes);
}

/**
 * Computes the S256 code challenge for a verifier: `BASE64URL(SHA256(verifier))`.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
	const data = new TextEncoder().encode(verifier);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Creates a verifier/challenge pair for PKCE.
 * Prefer {@link AuthClient.signIn} unless building authorize URLs manually.
 */
export async function generatePkcePair(): Promise<PkcePair> {
	const verifier = generateCodeVerifier();
	const challenge = await generateCodeChallenge(verifier);
	return { verifier, challenge, method: "S256" };
}
