import { describe, expect, it } from "vitest";
import { resolveTokenDelivery } from "../../src/config/resolve-token-delivery.js";

describe("resolveTokenDelivery", () => {
	it("uses cookie for web in browser by default", () => {
		expect(
			resolveTokenDelivery({
				issuer: "http://localhost:3000",
				clientId: "c",
				redirectUri: "http://localhost:5173/cb",
				platform: "web",
			}),
		).toBe("cookie");
	});

	it("uses body when forced", () => {
		expect(
			resolveTokenDelivery({
				issuer: "http://localhost:3000",
				clientId: "c",
				redirectUri: "http://localhost:5173/cb",
				tokenDelivery: "body",
			}),
		).toBe("body");
	});

	it("uses body for non-web platform", () => {
		expect(
			resolveTokenDelivery({
				issuer: "http://localhost:3000",
				clientId: "c",
				redirectUri: "myapp://cb",
				platform: "ios",
			}),
		).toBe("body");
	});
});
