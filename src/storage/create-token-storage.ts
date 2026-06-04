import type { TokenDeliveryMode, TokenSet } from "../types.js";
import {
	clearRefreshSessionFlag,
	hasRefreshSessionFlag,
	markRefreshSessionActive,
} from "./session-flag.js";
import { BodyTokenStorage } from "./token-storage-body.js";
import { CookieTokenStorage } from "./token-storage-cookie.js";

/**
 * Token storage strategy.
 *
 * - **cookie (web default):** AT + ID token in memory; RT in HttpOnly cookie on auth origin
 * - **body:** full token set in sessionStorage/localStorage (non-browser / explicit fallback)
 */
export interface ITokenStorage {
	get(): TokenSet | null;
	set(tokens: TokenSet): void;
	clear(): void;
	/** Whether a refresh is possible (RT in storage or cookie session flag). */
	canRefresh(): boolean;
	getRefreshTokenForBody(): string | undefined;
}

export function createTokenStorage(
	clientId: string,
	delivery: TokenDeliveryMode,
	mode?: "memory" | "sessionStorage" | "localStorage",
): ITokenStorage {
	if (delivery === "cookie") {
		return new CookieTokenStorage(clientId);
	}

	return new BodyTokenStorage(clientId, mode ?? "sessionStorage");
}

export {
	clearRefreshSessionFlag,
	hasRefreshSessionFlag,
	markRefreshSessionActive,
};
