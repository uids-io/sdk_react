/**
 * Errors thrown by HTTP calls to the auth server and SDK validation.
 *
 * Use type guards {@link isOAuthError} and {@link isTokenReuseError} in catch blocks.
 */

/** Single field validation issue from HTTP 422 responses. */
export interface ValidationDetail {
	field: string;
	message: string;
}

/**
 * Base error for all SDK failures.
 *
 * @property code - Machine-readable code (OAuth `error` or app-specific)
 * @property statusCode - HTTP status when the error originated from `fetch`
 */
export class AuthSdkError extends Error {
	readonly code: string;
	readonly statusCode: number;

	constructor(message: string, code: string, statusCode = 500) {
		super(message);
		this.name = "AuthSdkError";
		this.code = code;
		this.statusCode = statusCode;
	}
}

/**
 * OAuth 2.0 error response: `{ error, error_description }`.
 *
 * Typical codes: `invalid_request`, `invalid_grant`, `unauthorized`.
 */
export class OAuthError extends AuthSdkError {
	readonly error: string;
	readonly errorDescription: string;

	constructor(error: string, errorDescription: string, statusCode = 400) {
		super(errorDescription, error, statusCode);
		this.name = "OAuthError";
		this.error = error;
		this.errorDescription = errorDescription;
	}
}

/**
 * Request body failed server-side validation (HTTP 422).
 *
 * Inspect {@link ValidationError.details} for per-field messages.
 */
export class ValidationError extends AuthSdkError {
	readonly details: ValidationDetail[];

	constructor(
		message: string,
		details: ValidationDetail[],
		code = "VALIDATION_ERROR",
	) {
		super(message, code, 422);
		this.name = "ValidationError";
		this.details = details;
	}
}

/**
 * Refresh token was reused or revoked (`invalid_grant`).
 *
 * {@link AuthClient.refresh} clears local tokens when this is thrown.
 * Redirect the user to {@link AuthClient.signIn}.
 */
export class TokenReuseError extends OAuthError {
	constructor(description: string) {
		super("invalid_grant", description, 400);
		this.name = "TokenReuseError";
	}
}

/** @returns True if `error` is an {@link OAuthError} (including {@link TokenReuseError}). */
export function isOAuthError(error: unknown): error is OAuthError {
	return error instanceof OAuthError;
}

/** @returns True if `error` indicates refresh token reuse — session should restart. */
export function isTokenReuseError(error: unknown): error is TokenReuseError {
	return error instanceof TokenReuseError;
}
