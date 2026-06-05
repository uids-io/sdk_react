import { OAuthError } from "../errors.js";
import { oauthRedirectTransactionKey } from "./keys.js";

export type RedirectTransactionStatus =
	| "pending"
	| "claimed"
	| "completed"
	| "failed";

/** OAuth redirect leg stored in sessionStorage for the PKCE authorization code flow. */
export interface RedirectTransaction {
	status: RedirectTransactionStatus;
	state: string;
	verifier: string;
	code?: string;
	error?: string;
	claimedAt?: number;
	completedAt?: number;
}

export type ClaimCallbackResult =
	| { kind: "claimed"; transaction: RedirectTransaction }
	| { kind: "await_claimed"; transaction: RedirectTransaction }
	| { kind: "already_completed" };

export interface ClaimCallbackParams {
	code: string;
	state: string | null;
}

/**
 * Session-scoped OAuth redirect transaction (PKCE verifier + state + claim status).
 * Survives React Strict Mode remounts within the same browser tab.
 */
export class OAuthRedirectStorage {
	constructor(private readonly clientId: string) {}

	private storageKey(): string {
		return oauthRedirectTransactionKey(this.clientId);
	}

	private read(): RedirectTransaction | null {
		const raw = sessionStorage.getItem(this.storageKey());

		if (!raw) {
			return null;
		}

		try {
			return JSON.parse(raw) as RedirectTransaction;
		} catch {
			return null;
		}
	}

	private write(transaction: RedirectTransaction): void {
		sessionStorage.setItem(this.storageKey(), JSON.stringify(transaction));
	}

	/** Called from {@link AuthClient.signIn} before redirecting to the auth server. */
	start(verifier: string, state: string): void {
		this.clear();
		this.write({
			status: "pending",
			verifier,
			state,
		});
	}

	get(): RedirectTransaction | null {
		return this.read();
	}

	isCompleted(): boolean {
		return this.read()?.status === "completed";
	}

	/**
	 * Captures callback params once. Only the first caller moves `pending` → `claimed`.
	 */
	claimCallback(params: ClaimCallbackParams): ClaimCallbackResult {
		const transaction = this.read();
		if (!transaction) {
			throw new OAuthError(
				"invalid_request",
				"No OAuth redirect in progress — restart sign-in",
			);
		}

		if (transaction.status === "completed") {
			return { kind: "already_completed" };
		}

		if (transaction.status === "failed") {
			throw new OAuthError(
				"invalid_request",
				"OAuth redirect failed — restart sign-in",
			);
		}

		if (transaction.status === "claimed") {
			if (transaction.code === params.code) {
				return { kind: "await_claimed", transaction };
			}
			throw new OAuthError(
				"invalid_request",
				"OAuth redirect already claimed with a different code",
			);
		}

		if (transaction.status !== "pending") {
			throw new OAuthError("invalid_request", "Invalid OAuth redirect state");
		}

		if (params.state !== null && params.state !== transaction.state) {
			this.markFailed();
			throw new OAuthError("invalid_request", "Invalid OAuth state");
		}

		const claimed: RedirectTransaction = {
			...transaction,
			status: "claimed",
			code: params.code,
			claimedAt: Date.now(),
		};
		this.write(claimed);

		return { kind: "claimed", transaction: claimed };
	}

	markCompleted(): void {
		const transaction = this.read();
		if (!transaction) {
			return;
		}

		this.write({
			...transaction,
			status: "completed",
			completedAt: Date.now(),
		});
	}

	markFailed(): void {
		const transaction = this.read();
		if (!transaction) {
			return;
		}

		this.write({
			...transaction,
			status: "failed",
		});
	}

	clear(): void {
		sessionStorage.removeItem(this.storageKey());
	}
}
