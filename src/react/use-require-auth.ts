import { useEffect } from "react";
import { useAuth } from "./use-auth.js";

/**
 * Guard hook for protected routes: redirects unauthenticated users to sign-in.
 *
 * Waits until {@link useAuth} `isLoading` is `false`, then calls `signIn()` if
 * `isAuthenticated` is `false`. Combine with a dedicated `/auth/callback` route
 * that runs {@link AuthClient.handleCallback}.
 *
 * @example
 * ```tsx
 * function DashboardPage() {
 *   useRequireAuth();
 *   return <div>Protected content</div>;
 * }
 * ```
 */
export function useRequireAuth(): void {
	const { isAuthenticated, isLoading, signIn } = useAuth();

	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			signIn();
		}
	}, [isAuthenticated, isLoading, signIn]);
}
