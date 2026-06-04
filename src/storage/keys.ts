export function deviceStorageKey(clientId: string): string {
	return `uids:device_id:${clientId}`;
}

export function pkceVerifierKey(clientId: string): string {
	return `uids:pkce_verifier:${clientId}`;
}

export function oauthStateKey(clientId: string): string {
	return `uids:oauth_state:${clientId}`;
}

export function accessTokenStorageKey(clientId: string): string {
	return `uids:access_token:${clientId}`;
}
