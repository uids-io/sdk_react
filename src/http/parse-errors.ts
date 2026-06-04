import {
	AuthSdkError,
	OAuthError,
	TokenReuseError,
	type ValidationDetail,
	ValidationError,
} from "../errors.js";

interface OAuthErrorBody {
	error?: string;
	error_description?: string;
}

interface ValidationErrorBody {
	success?: boolean;
	message?: string;
	error?: {
		code?: string;
		details?: ValidationDetail[];
	};
}

export async function parseAuthResponseError(
	response: Response,
): Promise<AuthSdkError> {
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		return new AuthSdkError(
			response.statusText || "Request failed",
			"request_failed",
			response.status,
		);
	}

	if (response.status === 422 && body && typeof body === "object") {
		const v = body as ValidationErrorBody;
		const details = v.error?.details ?? [];
		return new ValidationError(
			v.message ?? "Validation failed",
			details,
			v.error?.code ?? "VALIDATION_ERROR",
		);
	}

	if (body && typeof body === "object") {
		const o = body as OAuthErrorBody;
		if (typeof o.error === "string") {
			const description =
				typeof o.error_description === "string" ? o.error_description : o.error;
			if (
				o.error === "invalid_grant" &&
				/reuse|revoked|compromised/i.test(description)
			) {
				return new TokenReuseError(description);
			}
			return new OAuthError(o.error, description, response.status);
		}
	}

	return new AuthSdkError("Request failed", "request_failed", response.status);
}
