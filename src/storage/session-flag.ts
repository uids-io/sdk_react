import { accessTokenStorageKey } from "./keys.js";

/** Tracks that a refresh session exists when RT is in an HttpOnly cookie (not readable from JS). */
const SESSION_FLAG_SUFFIX = ":refresh_session";

export function refreshSessionFlagKey(clientId: string): string {
	return `${accessTokenStorageKey(clientId)}${SESSION_FLAG_SUFFIX}`;
}

export function markRefreshSessionActive(clientId: string): void {
	sessionStorage.setItem(refreshSessionFlagKey(clientId), "1");
}

export function clearRefreshSessionFlag(clientId: string): void {
	sessionStorage.removeItem(refreshSessionFlagKey(clientId));
}

export function hasRefreshSessionFlag(clientId: string): boolean {
	return sessionStorage.getItem(refreshSessionFlagKey(clientId)) === "1";
}
