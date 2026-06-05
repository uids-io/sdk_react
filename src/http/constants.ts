export const DEVICE_ID_HEADER = "X-Uids-Device-Id";

/** CSRF header for credentialed auth POSTs when `uids_csrf` cookie is readable. */
export { CSRF_COOKIE_NAME, CSRF_HEADER } from "./csrf.js";

/** Ask auth server to set refresh token as HttpOnly cookie (web browser SDK). */
export const TOKEN_DELIVERY_HEADER = "X-Uids-Token-Delivery";

export const TOKEN_DELIVERY_COOKIE = "cookie";

export const DEFAULT_SCOPE = "openid profile email";

/**
 * OIDC discovery path when auth router is mounted at the issuer root (default).
 * @example `https://auth.example.com/.well-known/openid-configuration`
 */
export const OPENID_CONFIGURATION_PATH = "/.well-known/openid-configuration";
