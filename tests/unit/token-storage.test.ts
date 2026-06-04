import { beforeEach, describe, expect, it } from "vitest";
import {
	clearRefreshSessionFlag,
	hasRefreshSessionFlag,
} from "../../src/storage/session-flag.js";
import { BodyTokenStorage } from "../../src/storage/token-storage-body.js";
import { CookieTokenStorage } from "../../src/storage/token-storage-cookie.js";

describe("BodyTokenStorage", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	const tokens = {
		accessToken: "access",
		refreshToken: "refresh",
		tokenType: "Bearer" as const,
		expiresIn: 3600,
		expiresAt: Date.now() + 3_600_000,
	};

	it("persists refresh token in sessionStorage across reload simulation", () => {
		const a = new BodyTokenStorage("client_a", "sessionStorage");
		a.set(tokens);
		const b = new BodyTokenStorage("client_a", "sessionStorage");
		expect(b.get()?.refreshToken).toBe("refresh");
	});
});

describe("CookieTokenStorage", () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it("keeps refresh out of memory but marks session flag", () => {
		const storage = new CookieTokenStorage("merchant");
		storage.set({
			accessToken: "at",
			refreshToken: "rt",
			tokenType: "Bearer",
			expiresIn: 900,
			expiresAt: Date.now() + 900_000,
		});
		expect(storage.get()?.refreshToken).toBeUndefined();
		expect(storage.get()?.accessToken).toBe("at");
		expect(hasRefreshSessionFlag("merchant")).toBe(true);
		expect(storage.canRefresh()).toBe(true);
		storage.clear();
		clearRefreshSessionFlag("merchant");
		expect(storage.canRefresh()).toBe(false);
	});
});
