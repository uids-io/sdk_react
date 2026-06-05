import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthClient } from "../../src/auth-client";
import { OAuthRedirectStorage } from "../../src/storage/oauth-redirect-storage.js";

const config = {
	issuer: "http://localhost:3000/auth",
	clientId: "billing_portal_web",
	redirectUri: "http://localhost:5173/auth/callback",
	tokenDelivery: "body" as const,
};

describe("handleCallback", () => {
	beforeEach(() => {
		sessionStorage.clear();
		localStorage.clear();
		new OAuthRedirectStorage(config.clientId).start(
			"verifier-secret",
			"state-1",
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		sessionStorage.clear();
		localStorage.clear();
	});

	it("exchanges the authorization code only once when called concurrently", async () => {
		let tokenPosts = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.includes("/token") && init?.method === "POST") {
					tokenPosts += 1;
					return new Response(
						JSON.stringify({
							access_token: "at",
							token_type: "Bearer",
							expires_in: 3600,
							refresh_token: "rt",
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				return new Response("{}", { status: 404 });
			}),
		);

		const client = createAuthClient(config);
		const params = {
			code: "auth-code-1",
			state: "state-1",
			error: null,
			error_description: null,
		};

		const [a, b] = await Promise.all([
			client.handleCallback(params),
			client.handleCallback(params),
		]);

		expect(tokenPosts).toBe(1);
		expect(a.accessToken).toBe("at");
		expect(b.accessToken).toBe("at");
	});

	it("returns stored tokens when redirect transaction is already completed", async () => {
		let tokenPosts = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.includes("/token") && init?.method === "POST") {
					tokenPosts += 1;
					return new Response(
						JSON.stringify({
							access_token: "at",
							token_type: "Bearer",
							expires_in: 3600,
							refresh_token: "rt",
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				return new Response("{}", { status: 404 });
			}),
		);

		const client = createAuthClient(config);
		const params = {
			code: "auth-code-1",
			state: "state-1",
			error: null,
			error_description: null,
		};

		await client.handleCallback(params);
		const replay = await client.handleCallback(params);

		expect(tokenPosts).toBe(1);
		expect(replay.accessToken).toBe("at");
	});
});
