import { describe, expect, it } from "vitest";
import { buildAuthorizeUrl } from "../../src/oauth/authorize-url.js";

describe("buildAuthorizeUrl", () => {
	it("includes PKCE, client, redirect, device, and platform", () => {
		const url = new URL(
			buildAuthorizeUrl({
				config: {
					issuer: "https://auth.example.com/",
					clientId: "merchant_portal_web",
					redirectUri: "http://localhost:5173/auth/callback",
					platform: "web",
				},
				pkce: {
					verifier: "v",
					challenge: "challenge123",
					method: "S256",
				},
				deviceId: "550e8400-e29b-41d4-a716-446655440000",
				state: "state-abc",
			}),
		);

		expect(url.pathname).toBe("/authorize");
		expect(url.searchParams.get("client_id")).toBe("merchant_portal_web");
		expect(url.searchParams.get("code_challenge")).toBe("challenge123");
	});

	it("passes login_provider when options.provider is set", () => {
		const url = new URL(
			buildAuthorizeUrl({
				config: {
					issuer: "https://auth.example.com",
					clientId: "merchant_portal_web",
					redirectUri: "http://localhost:5173/auth/callback",
				},
				pkce: {
					verifier: "v",
					challenge: "c",
					method: "S256",
				},
				deviceId: "550e8400-e29b-41d4-a716-446655440000",
				state: "s",
				options: { provider: "google" },
			}),
		);

		expect(url.searchParams.get("login_provider")).toBe("google");
	});

	it("preserves issuer mount path (not new URL absolute-path behavior)", () => {
		const url = new URL(
			buildAuthorizeUrl({
				config: {
					issuer: "http://localhost:3000/auth",
					clientId: "billing_portal_web",
					redirectUri: "http://localhost:5173/auth/callback",
				},
				pkce: {
					verifier: "v",
					challenge: "c",
					method: "S256",
				},
				deviceId: "550e8400-e29b-41d4-a716-446655440000",
				state: "s",
				options: { provider: "google" },
			}),
		);

		expect(url.origin).toBe("http://localhost:3000");
		expect(url.pathname).toBe("/auth/authorize");
		expect(url.searchParams.get("login_provider")).toBe("google");
	});
});
