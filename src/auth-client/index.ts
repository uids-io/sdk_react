/**
 * Framework-agnostic OAuth client for `@advcomm/uids-io-auth`.
 *
 * **Web (default):** access + ID token in memory; refresh token in HttpOnly cookie on the
 * auth issuer; multi-tab refresh coordinated via {@link TabCoordinator}.
 *
 * **Body fallback:** full token set in browser storage when `tokenDelivery: "body"` or
 * non-web platform — for Flutter web JSON parity and tests.
 *
 * @see docs/TOKEN_STORAGE.md
 * @see docs/OAUTH_REDIRECT_PLAN.md
 */

export { createAuthClient } from "./create-client.js";
export type { AuthClient } from "./types.js";
