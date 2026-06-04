import type { TokenResponseJson, TokenSet } from "../types.js";

export function mapTokenResponse(json: TokenResponseJson): TokenSet {
	const expiresAt = Date.now() + json.expires_in * 1000;
	return {
		accessToken: json.access_token,
		refreshToken: json.refresh_token,
		tokenType: json.token_type,
		expiresIn: json.expires_in,
		expiresAt,
		scope: json.scope,
		idToken: json.id_token,
	};
}
