import { oauthStateKey, pkceVerifierKey } from "./keys.js";

/** PKCE verifier and OAuth state live in sessionStorage for the redirect leg only. */
export class PkceSessionStorage {
	constructor(private readonly clientId: string) {}

	save(verifier: string, state: string): void {
		sessionStorage.setItem(pkceVerifierKey(this.clientId), verifier);
		sessionStorage.setItem(oauthStateKey(this.clientId), state);
	}

	getVerifier(): string | null {
		return sessionStorage.getItem(pkceVerifierKey(this.clientId));
	}

	getExpectedState(): string | null {
		return sessionStorage.getItem(oauthStateKey(this.clientId));
	}

	clear(): void {
		sessionStorage.removeItem(pkceVerifierKey(this.clientId));
		sessionStorage.removeItem(oauthStateKey(this.clientId));
	}
}
