import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { AuthClient } from "../auth-client";
import { getOrCreateAuthClient } from "../client-registry.js";
import { userFromIdToken } from "../oauth/jwt-decode.js";
import { getEnabledProviders } from "../oauth/providers.js";
import type {
	AuthProvidersResponse,
	AuthReactConfig,
	TokenSet,
} from "../types.js";
import { AuthContext, type AuthContextValue } from "./auth-context.js";

/**
 * Props for {@link AuthProvider}.
 */
export interface AuthProviderProps {
	/** Portal OAuth configuration — keep referentially stable (`useMemo` or module constant). */
	config: AuthReactConfig;

	children: ReactNode;

	/**
	 * When `true` (default), restores the session via {@link AuthClient.initialize}
	 * (silent refresh when a cookie/body refresh session exists).
	 */
	autoInitialize?: boolean;

	/**
	 * When `true`, fetches `GET /.well-known/oauth-providers` on mount.
	 * Default `false` — call {@link AuthContextValue.loadProviders} from login UI.
	 */
	loadProvidersOnMount?: boolean;
}

/**
 * Root provider: session state, optional provider list, and auth actions.
 */
export function AuthProvider({
	config,
	children,
	autoInitialize = true,
	loadProvidersOnMount = false,
}: AuthProviderProps) {
	const client = useMemo(() => getOrCreateAuthClient(config), [config]);
	const [tokens, setTokens] = useState<TokenSet | null>(null);
	const [providers, setProviders] = useState<AuthProvidersResponse | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(autoInitialize);
	const [isLoadingProviders, setIsLoadingProviders] =
		useState(loadProvidersOnMount);
	const [error, setError] = useState<Error | null>(null);

	const loadProviders = useCallback(async () => {
		setIsLoadingProviders(true);
		try {
			const providerList = await client.loadProviders();
			setProviders(providerList);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e : new Error(String(e)));
			throw e;
		} finally {
			setIsLoadingProviders(false);
		}
	}, [client]);

	useEffect(() => {
		let cancelled = false;

		async function bootstrap() {
			if (!autoInitialize && !loadProvidersOnMount) {
				setIsLoading(false);
				return;
			}

			try {
				if (autoInitialize) {
					await client.initialize();
				}
				if (loadProvidersOnMount) {
					const providerList = await client.loadProviders();
					if (!cancelled) {
						setProviders(providerList);
					}
				}
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e : new Error(String(e)));
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
					if (!loadProvidersOnMount) {
						setIsLoadingProviders(false);
					}
				}
			}
		}

		void bootstrap();
		const unsubscribe = client.onTokensChanged((next) => {
			if (!cancelled) {
				setTokens(next);
			}
		});

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [client, autoInitialize, loadProvidersOnMount]);

	const signIn = useCallback<AuthClient["signIn"]>(
		async (options) => {
			setError(null);
			try {
				await client.signIn(options);
			} catch (e) {
				setError(e instanceof Error ? e : new Error(String(e)));
				throw e;
			}
		},
		[client],
	);

	const signOut = useCallback<AuthClient["signOut"]>(async () => {
		setError(null);
		try {
			await client.signOut();
		} catch (e) {
			setError(e instanceof Error ? e : new Error(String(e)));
			throw e;
		}
	}, [client]);

	const clearError = useCallback(() => setError(null), []);

	const enabledProviders = useMemo(
		() => (providers ? getEnabledProviders(providers) : []),
		[providers],
	);

	const value = useMemo<AuthContextValue>(
		() => ({
			client,
			isAuthenticated: Boolean(tokens?.accessToken),
			isLoading,
			isLoadingProviders,
			user: userFromIdToken(tokens?.idToken),
			providers,
			enabledProviders,
			error,
			loadProviders,
			signIn,
			signOut,
			clearError,
		}),
		[
			client,
			tokens,
			isLoading,
			isLoadingProviders,
			providers,
			enabledProviders,
			error,
			loadProviders,
			signIn,
			signOut,
			clearError,
		],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
