import { describe, expect, it } from "vitest";
import {
	generateCodeChallenge,
	generateCodeVerifier,
	generatePkcePair,
} from "../../src/pkce.js";

describe("PKCE", () => {
	it("generates S256 challenge from verifier", async () => {
		const verifier = generateCodeVerifier();
		const challenge = await generateCodeChallenge(verifier);
		expect(verifier.length).toBeGreaterThan(40);
		expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
		const pair = await generatePkcePair();
		expect(pair.method).toBe("S256");
		const expected = await generateCodeChallenge(pair.verifier);
		expect(pair.challenge).toBe(expected);
	});
});
