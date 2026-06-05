/** Matches auth server `uids_csrf` cookie (readable, not HttpOnly). */
export const CSRF_COOKIE_NAME = "uids_csrf";

/** Header expected by auth server CSRF middleware. */
export const CSRF_HEADER = "X-CSRF-Token";

/** Reads `uids_csrf` when the portal is same-origin with the auth issuer (or proxied). */
export function readCsrfTokenFromDocumentCookie(): string | undefined {
	if (typeof document === "undefined") {
		return undefined;
	}
	const match = document.cookie.match(
		new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`),
	);
	const value = match?.[1];
	return value ? decodeURIComponent(value) : undefined;
}

/** CSRF headers for credentialed POSTs when the CSRF cookie is readable in JS. */
export function csrfHeaders(): HeadersInit {
	const token = readCsrfTokenFromDocumentCookie();
	if (!token) {
		return {};
	}
	return { [CSRF_HEADER]: token };
}
