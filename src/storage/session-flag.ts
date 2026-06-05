import { accessTokenStorageKey } from "./keys.js";

/** Tracks that a refresh session exists when RT is in an HttpOnly cookie (not readable from JS). */
const SESSION_FLAG_SUFFIX = ":refresh_session";

function storage(): Storage | null {
	if (typeof localStorage === "undefined") {
		return null;
	}
	return localStorage;
}

export function refreshSessionFlagKey(clientId: string): string {
	return `${accessTokenStorageKey(clientId)}${SESSION_FLAG_SUFFIX}`;
}

export function markRefreshSessionActive(clientId: string): void {
	storage()?.setItem(refreshSessionFlagKey(clientId), "1");
}

export function clearRefreshSessionFlag(clientId: string): void {
	storage()?.removeItem(refreshSessionFlagKey(clientId));
}

export function hasRefreshSessionFlag(clientId: string): boolean {
	return storage()?.getItem(refreshSessionFlagKey(clientId)) === "1";
}
