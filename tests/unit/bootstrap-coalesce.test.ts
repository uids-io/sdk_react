import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthClient } from "../../src/auth-client/create-client.js";
import {
	clearOpenIdDiscoveryCache,
	fetchOpenIdConfiguration,
} from "../../src/oauth/openid-discovery.js";
import { markRefreshSessionActive } from "../../src/storage/session-flag.js";

const discoveryDoc = {
	issuer: "http://localhost:3000/auth",
	authorization_endpoint: "http://localhost:3000/auth/authorize",
	token_endpoint: "http://localhost:3000/auth/token",
};

describe("bootstrap coalesce", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		clearOpenIdDiscoveryCache();
		sessionStorage.clear();
		localStorage.clear();
	});

	it("fetches openid-configuration once when called concurrently", async () => {
		let fetches = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				fetches += 1;
				return new Response(JSON.stringify(discoveryDoc), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}),
		);

		const url = "http://localhost:3000/auth/.well-known/openid-configuration";
		await Promise.all([
			fetchOpenIdConfiguration(url),
			fetchOpenIdConfiguration(url),
		]);

		expect(fetches).toBe(1);
	});

	it("runs silent refresh once when initialize is called concurrently", async () => {
		markRefreshSessionActive("billing_portal_web");

		let refreshPosts = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.includes("/refresh") && init?.method === "POST") {
					refreshPosts += 1;
					return new Response(
						JSON.stringify({
							access_token: "at",
							token_type: "Bearer",
							expires_in: 3600,
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					);
				}
				return new Response("{}", { status: 404 });
			}),
		);

		const client = createAuthClient({
			issuer: "http://localhost:3000/auth",
			clientId: "billing_portal_web",
			redirectUri: "http://localhost:5173/auth/callback",
			tokenDelivery: "cookie",
		});

		await Promise.all([client.initialize(), client.initialize()]);

		expect(refreshPosts).toBe(1);
	});
});
