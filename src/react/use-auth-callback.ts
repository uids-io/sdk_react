import { useEffect, useRef, useState } from "react";
import {
	clearOAuthCallbackSnapshot,
	clearOAuthRedirectFromUrl,
	isOAuthRedirectParams,
} from "../oauth/parse-redirect.js";
import type { TokenSet } from "../types.js";
import { useAuth } from "./use-auth.js";

export interface UseAuthCallbackOptions {
	/** Called after tokens are stored successfully. */
	onSuccess?: (tokens: TokenSet) => void;
	/** Called when callback handling fails. */
	onError?: (error: Error) => void;
	/**
	 * Path written by {@link clearOAuthRedirectFromUrl} after params are read.
	 * Defaults to `pathname + hash` (query stripped).
	 */
	fallbackPath?: string;
}

export interface UseAuthCallbackResult {
	/** `true` while the authorization code is being exchanged. */
	isProcessing: boolean;
	/** Set when exchange fails or the callback URL has no OAuth params. */
	error: Error | null;
}

/**
 * Handles the OAuth redirect callback on a dedicated route.
 *
 * Strips `code` / `state` from the URL synchronously, then exchanges the code once
 * via the redirect transaction (safe under React Strict Mode).
 *
 * @example
 * ```tsx
 * function CallbackPage() {
 *   const navigate = useNavigate();
 *   const { isProcessing, error } = useAuthCallback({
 *     onSuccess: () => navigate("/dashboard", { replace: true }),
 *   });
 *   if (error) return <p>{error.message}</p>;
 *   return <p>{isProcessing ? "Completing sign-in…" : "Redirecting…"}</p>;
 * }
 * ```
 */
export function useAuthCallback(
	options: UseAuthCallbackOptions = {},
): UseAuthCallbackResult {
	const { client } = useAuth();
	const [isProcessing, setIsProcessing] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const onSuccessRef = useRef(options.onSuccess);
	const onErrorRef = useRef(options.onError);
	onSuccessRef.current = options.onSuccess;
	onErrorRef.current = options.onError;

	useEffect(() => {
		const params = clearOAuthRedirectFromUrl(options.fallbackPath);

		if (!isOAuthRedirectParams(params)) {
			setIsProcessing(false);
			setError(new Error("No OAuth callback parameters in URL"));
			return;
		}

		let cancelled = false;

		void client
			.handleCallback(params)
			.then((tokens) => {
				if (!cancelled) {
					clearOAuthCallbackSnapshot();
					setIsProcessing(false);
					onSuccessRef.current?.(tokens);
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					const next = err instanceof Error ? err : new Error(String(err));
					setError(next);
					setIsProcessing(false);
					onErrorRef.current?.(next);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [client, options.fallbackPath]);

	return { isProcessing, error };
}
