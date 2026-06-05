import { beforeEach, describe, expect, it } from "vitest";
import { OAuthError } from "../../src/errors.js";
import { OAuthRedirectStorage } from "../../src/storage/oauth-redirect-storage.js";

describe("OAuthRedirectStorage", () => {
	const clientId = "billing_portal_web";
	let storage: OAuthRedirectStorage;

	beforeEach(() => {
		sessionStorage.clear();
		storage = new OAuthRedirectStorage(clientId);
	});

	it("starts a pending transaction on signIn", () => {
		storage.start("verifier", "state-1");
		expect(storage.get()?.status).toBe("pending");
		expect(storage.get()?.verifier).toBe("verifier");
	});

	it("claims callback once and rejects state mismatch", () => {
		storage.start("verifier", "state-1");
		const claim = storage.claimCallback({ code: "code-1", state: "state-1" });
		expect(claim.kind).toBe("claimed");
		expect(storage.get()?.status).toBe("claimed");

		const replay = storage.claimCallback({ code: "code-1", state: "state-1" });
		expect(replay.kind).toBe("await_claimed");

		storage.clear();
		storage.start("verifier", "state-1");
		expect(() =>
			storage.claimCallback({ code: "code-1", state: "wrong" }),
		).toThrow(OAuthError);
	});

	it("reports already completed after markCompleted", () => {
		storage.start("verifier", "state-1");
		storage.claimCallback({ code: "code-1", state: "state-1" });
		storage.markCompleted();
		expect(
			storage.claimCallback({ code: "code-1", state: "state-1" }).kind,
		).toBe("already_completed");
	});
});
