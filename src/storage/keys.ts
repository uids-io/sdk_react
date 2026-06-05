export function deviceStorageKey(clientId: string): string {
	return `uids:device_id:${clientId}`;
}

export function oauthRedirectTransactionKey(clientId: string): string {
	return `uids:oauth_redirect:${clientId}`;
}

export function accessTokenStorageKey(clientId: string): string {
	return `uids:access_token:${clientId}`;
}
