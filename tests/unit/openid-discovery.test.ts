import { describe, expect, it } from "vitest";
import {
	buildAuthReactConfigFromDiscovery,
	scopeFromDiscovery,
	type OpenIdConfiguration,
} from "../../src/oauth/openid-discovery.js";

const discovery: OpenIdConfiguration = {
	issuer: "http://localhost:3000/auth",
	authorization_endpoint: "http://localhost:3000/auth/authorize",
	token_endpoint: "http://localhost:3000/auth/token",
	scopes_supported: ["openid", "profile", "email"],
};

describe("buildAuthReactConfigFromDiscovery", () => {
	it("uses issuer from discovery document", () => {
		const config = buildAuthReactConfigFromDiscovery(discovery, {
			clientId: "billing_portal_web",
			redirectUri: "http://localhost:5173/auth/callback",
		});
		expect(config.issuer).toBe("http://localhost:3000/auth");
		expect(config.clientId).toBe("billing_portal_web");
	});
});

describe("scopeFromDiscovery", () => {
	it("joins supported openid scopes in order", () => {
		expect(scopeFromDiscovery(discovery)).toBe("openid profile email");
	});
});
