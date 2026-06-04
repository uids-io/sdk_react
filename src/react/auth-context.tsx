import { createContext } from "react";
import type { AuthClient } from "../auth-client.js";
import type {
	AuthProvidersResponse,
	AuthUser,
	LoginProviderId,
} from "../types.js";

/**
 * React context value exposed by {@link AuthProvider} and {@link useAuth}.
 */
export interface AuthContextValue {
	/** Underlying OAuth client (callback route, custom API wiring). */
	client: AuthClient;

	/** `true` when an access token is present after the latest token change. */
	isAuthenticated: boolean;

	/**
	 * `true` until bootstrap (session restore, device register, providers fetch) finishes.
	 */
	isLoading: boolean;

	/**
	 * Profile from ID token claims for UI only — not cryptographically verified here.
	 */
	user: AuthUser | null;

	/** Enabled login providers from auth server (null while loading). */
	providers: AuthProvidersResponse | null;

	/** Convenience: enabled provider ids only. */
	enabledProviders: LoginProviderId[];

	/** Last error from provider bootstrap, `signIn`, or `signOut`. */
	error: Error | null;

	/** Starts PKCE login; optional `{ provider: 'google' }` for direct IdP. */
	signIn: AuthClient["signIn"];

	/** Revokes session and clears local tokens. */
	signOut: AuthClient["signOut"];

	clearError: () => void;
}

/** @internal */
export const AuthContext = createContext<AuthContextValue | null>(null);
