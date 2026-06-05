/** OAuth redirect query parameters from the portal callback URL. */
export interface OAuthRedirectParams {
	code: string | null;
	state: string | null;
	error: string | null;
	error_description: string | null;
}

const CALLBACK_SNAPSHOT_KEY = "uids:oauth_callback_params";

const REDIRECT_PARAM_NAMES = [
	"code",
	"state",
	"error",
	"error_description",
] as const;

function toSearchParams(
	urlOrSearch: string | URLSearchParams,
): URLSearchParams {
	if (typeof urlOrSearch === "string") {
		return new URL(urlOrSearch, "http://localhost").searchParams;
	}

	return urlOrSearch;
}

/**
 * Parses OAuth callback query parameters without mutating the browser URL.
 */
export function parseOAuthRedirect(
	urlOrSearch: string | URLSearchParams,
): OAuthRedirectParams {
	const params = toSearchParams(urlOrSearch);

	return {
		code: params.get("code"),
		state: params.get("state"),
		error: params.get("error"),
		error_description: params.get("error_description"),
	};
}

/**
 * Removes the session snapshot written by {@link clearOAuthRedirectFromUrl}.
 * Call after a successful callback exchange.
 */
export function clearOAuthCallbackSnapshot(): void {
	sessionStorage.removeItem(CALLBACK_SNAPSHOT_KEY);
}

/**
 * Reads OAuth callback params and removes them from the address bar synchronously.
 * Params are snapshotted in sessionStorage so React Strict Mode remounts can replay safely.
 * Call this before any `await` on the callback route.
 */
export function clearOAuthRedirectFromUrl(
	fallbackPath?: string,
): OAuthRedirectParams {
	const fromUrl = parseOAuthRedirect(window.location.search);

	if (isOAuthRedirectParams(fromUrl)) {
		sessionStorage.setItem(CALLBACK_SNAPSHOT_KEY, JSON.stringify(fromUrl));
		const nextPath =
			fallbackPath ?? `${window.location.pathname}${window.location.hash}`;
		window.history.replaceState({}, "", nextPath);
		return fromUrl;
	}

	const snapshot = sessionStorage.getItem(CALLBACK_SNAPSHOT_KEY);
	if (snapshot) {
		try {
			return JSON.parse(snapshot) as OAuthRedirectParams;
		} catch {
			clearOAuthCallbackSnapshot();
		}
	}

	return fromUrl;
}

/** @internal Returns true when params look like an OAuth redirect callback. */
export function isOAuthRedirectParams(params: OAuthRedirectParams): boolean {
	return Boolean(params.code || params.error);
}

/** Removes OAuth callback keys from a URLSearchParams instance. */
export function stripOAuthRedirectParams(
	params: URLSearchParams,
): URLSearchParams {
	const next = new URLSearchParams(params);

	for (const name of REDIRECT_PARAM_NAMES) {
		next.delete(name);
	}

	return next;
}
