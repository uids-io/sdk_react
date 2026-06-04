import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./auth-context.js";

/**
 * Returns auth session state, **enabled login providers**, and actions.
 *
 * @example
 * ```tsx
 * const { enabledProviders, signIn, isLoading } = useAuth();
 *
 * if (enabledProviders.includes("google")) {
 *   return <button onClick={() => signIn({ provider: "google" })}>Google</button>;
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
	const ctx = useContext(AuthContext);
	if (!ctx) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return ctx;
}
