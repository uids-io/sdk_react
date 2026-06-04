import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { type AuthClient, createAuthClient } from "../auth-client.js";
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
	 * When `true` (default), calls {@link AuthClient.registerDevice} after {@link AuthClient.initialize}.
	 */
	registerOnMount?: boolean;
}

/**
 * Root provider: session, enabled login providers, and auth actions.
 *
 * Loads `GET /.well-known/oauth-providers` so portals can render provider-specific sign-in buttons.
 */
export function AuthProvider({
	config,
	children,
	registerOnMount = true,
}: AuthProviderProps) {
	const client = useMemo(() => createAuthClient(config), [config]);
	const [tokens, setTokens] = useState<TokenSet | null>(null);
	const [providers, setProviders] = useState<AuthProvidersResponse | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function bootstrap() {
			try {
				const providerList = await client.getProviders();
				if (!cancelled) {
					setProviders(providerList);
				}
				await client.initialize();
				if (registerOnMount) {
					await client.registerDevice();
				}
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e : new Error(String(e)));
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
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
	}, [client, registerOnMount]);

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
			user: userFromIdToken(tokens?.idToken),
			providers,
			enabledProviders,
			error,
			signIn,
			signOut,
			clearError,
		}),
		[
			client,
			tokens,
			isLoading,
			providers,
			enabledProviders,
			error,
			signIn,
			signOut,
			clearError,
		],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
