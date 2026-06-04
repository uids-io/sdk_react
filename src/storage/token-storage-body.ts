import type { TokenSet } from "../types.js";
import type { ITokenStorage } from "./create-token-storage.js";
import { accessTokenStorageKey } from "./keys.js";

export type BodyTokenStorageMode = "memory" | "sessionStorage" | "localStorage";

/**
 * Stores access + refresh tokens in browser storage (Flutter web / explicit fallback).
 * Use when `tokenDelivery: "body"` or non-web platforms via future SDKs.
 */
export class BodyTokenStorage implements ITokenStorage {
	private memory: TokenSet | null = null;

	constructor(
		private readonly clientId: string,
		private readonly mode: BodyTokenStorageMode = "sessionStorage",
	) {}

	private getStore(): Storage | null {
		if (this.mode === "sessionStorage") {
			return sessionStorage;
		}

		if (this.mode === "localStorage") {
			return localStorage;
		}

		return null;
	}

	private storageKey(): string {
		return accessTokenStorageKey(this.clientId);
	}

	private readFromBrowser(): TokenSet | null {
		const store = this.getStore();
		if (!store) {
			return null;
		}

		const raw = store.getItem(this.storageKey());
		if (!raw) {
			return null;
		}

		try {
			const tokens = JSON.parse(raw) as TokenSet;
			if (!tokens.accessToken || !tokens.expiresAt) {
				return null;
			}
			this.memory = tokens;
			return tokens;
		} catch {
			return null;
		}
	}

	private writeToBrowser(tokens: TokenSet): void {
		const store = this.getStore();
		if (!store) {
			return;
		}
		store.setItem(this.storageKey(), JSON.stringify(tokens));
	}

	private clearBrowser(): void {
		this.getStore()?.removeItem(this.storageKey());
	}

	get(): TokenSet | null {
		if (this.memory) {
			return this.memory;
		}
		return this.readFromBrowser();
	}

	set(tokens: TokenSet): void {
		this.memory = tokens;
		this.writeToBrowser(tokens);
	}

	clear(): void {
		this.memory = null;
		this.clearBrowser();
	}

	canRefresh(): boolean {
		return Boolean(this.get()?.refreshToken);
	}

	getRefreshTokenForBody(): string | undefined {
		return this.get()?.refreshToken;
	}
}
