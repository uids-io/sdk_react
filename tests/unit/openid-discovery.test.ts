import { describe, expect, it } from "vitest";
import {
	buildAuthReactConfigFromDiscovery,
	type OpenIdConfiguration,
	openIdDiscoveryUrl,
	scopeFromDiscovery,
} from "../../src/oauth/openid-discovery.js";

const discovery: OpenIdConfiguration = {
	issuer: "http://localhost:3000",
	authorization_endpoint: "http://localhost:3000/authorize",
	token_endpoint: "http://localhost:3000/token",
	scopes_supported: ["openid", "profile", "email"],
};

describe("buildAuthReactConfigFromDiscovery", () => {
	it("uses issuer from discovery document", () => {
		const config = buildAuthReactConfigFromDiscovery(discovery, {
			clientId: "billing_portal_web",
			redirectUri: "http://localhost:5173/auth/callback",
		});
		expect(config.issuer).toBe("http://localhost:3000");
		expect(config.clientId).toBe("billing_portal_web");
	});
});

describe("openIdDiscoveryUrl", () => {
	it("appends well-known path to issuer base URL", () => {
		expect(openIdDiscoveryUrl("http://localhost:3000/")).toBe(
			"http://localhost:3000/.well-known/openid-configuration",
		);
		expect(openIdDiscoveryUrl("http://localhost:3000/auth")).toBe(
			"http://localhost:3000/auth/.well-known/openid-configuration",
		);
	});
});

describe("scopeFromDiscovery", () => {
	it("joins supported openid scopes in order", () => {
		expect(scopeFromDiscovery(discovery)).toBe("openid profile email");
	});
});
