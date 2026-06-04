import { describe, expect, it } from "vitest";
import {
	OAuthError,
	TokenReuseError,
	ValidationError,
} from "../../src/errors.js";
import { parseAuthResponseError } from "../../src/http/parse-errors.js";

describe("parseAuthResponseError", () => {
	it("parses OAuth errors", async () => {
		const response = new Response(
			JSON.stringify({
				error: "invalid_grant",
				error_description: "Refresh token expired",
			}),
			{ status: 400 },
		);
		const err = await parseAuthResponseError(response);
		expect(err).toBeInstanceOf(OAuthError);
		expect((err as OAuthError).error).toBe("invalid_grant");
	});

	it("parses validation errors", async () => {
		const response = new Response(
			JSON.stringify({
				success: false,
				message: "Validation failed",
				error: {
					code: "VALIDATION_ERROR",
					details: [{ field: "client_id", message: "Required" }],
				},
			}),
			{ status: 422 },
		);
		const err = await parseAuthResponseError(response);
		expect(err).toBeInstanceOf(ValidationError);
	});

	it("detects token reuse", async () => {
		const response = new Response(
			JSON.stringify({
				error: "invalid_grant",
				error_description: "Refresh token reuse detected",
			}),
			{ status: 400 },
		);
		const err = await parseAuthResponseError(response);
		expect(err).toBeInstanceOf(TokenReuseError);
	});
});
