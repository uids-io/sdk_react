import { createContext } from "react";
import type { AuthClient } from "../auth-client";
import type {
	AuthProvidersResponse,
	AuthUser,
	LoginProviderId,
} from "../types.js";

/**
 * React context value exposed by {@link AuthProvider} and {@link useAuth}.
 */
export interface AuthContextValue {
	/** Underlying OAuth client (advanced wiring). */
	client: AuthClient;

	/** `true` when an access token is present after the latest token change. */
	isAuthenticated: boolean;

	/** `true` until {@link AuthClient.initialize} finishes on mount. */
	isLoading: boolean;

	/** `true` while {@link loadProviders} is in flight. */
	isLoadingProviders: boolean;

	/**
	 * Profile from ID token claims for UI only — not cryptographically verified here.
	 */
	user: AuthUser | null;

	/** Cached login providers (null until {@link loadProviders} runs). */
	providers: AuthProvidersResponse | null;

	/** Convenience: enabled provider ids only. */
	enabledProviders: LoginProviderId[];

	/** Last error from bootstrap, provider load, `signIn`, or `signOut`. */
	error: Error | null;

	/** Fetches enabled login providers from the auth server. */
	loadProviders: () => Promise<void>;

	/** Starts PKCE login; optional `{ provider: 'google' }` for direct IdP. */
	signIn: AuthClient["signIn"];

	/** Revokes session and clears local tokens. */
	signOut: AuthClient["signOut"];

	clearError: () => void;
}

/** @internal */
export const AuthContext = createContext<AuthContextValue | null>(null);
