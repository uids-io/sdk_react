import type { TokenSet } from "../types.js";
import type { ITokenStorage } from "./create-token-storage.js";
import {
	clearRefreshSessionFlag,
	hasRefreshSessionFlag,
	markRefreshSessionActive,
} from "./session-flag.js";

// hasRefreshSessionFlag used by canRefresh()

/**
 * Web-optimized split storage (see docs/TOKEN_STORAGE.md).
 *
 * - Access token + ID token: JavaScript memory only (short-lived, XSS window minimized)
 * - Refresh token: HttpOnly cookie on **auth issuer** origin (set by server; not readable from JS)
 * - Session flag in sessionStorage: remembers that cookie session exists after reload
 */
export class CookieTokenStorage implements ITokenStorage {
	private memory: TokenSet | null = null;

	constructor(private readonly clientId: string) {}

	get(): TokenSet | null {
		return this.memory;
	}

	set(tokens: TokenSet): void {
		const { refreshToken: _rt, ...withoutRefresh } = tokens;

		this.memory = {
			...withoutRefresh,
			refreshToken: undefined,
		};

		markRefreshSessionActive(this.clientId);
	}

	clear(): void {
		this.memory = null;
		clearRefreshSessionFlag(this.clientId);
	}

	canRefresh(): boolean {
		return hasRefreshSessionFlag(this.clientId);
	}

	getRefreshTokenForBody(): string | undefined {
		return undefined;
	}
}
