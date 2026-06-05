import type { OAuthRedirectParams } from "../oauth/parse-redirect.js";
import type {
	AuthorizeOptions,
	AuthProvidersResponse,
	Device,
	TokenSet,
} from "../types.js";

/**
 * OAuth + device client bound to one portal (`clientId` + `redirectUri`).
 */
export interface AuthClient {
	/** Login methods enabled on the auth server (Google, Microsoft, email). */
	getProviders(): Promise<AuthProvidersResponse>;
	/** Fetches providers from the auth server and caches the result on this client. */
	loadProviders(): Promise<AuthProvidersResponse>;
	getDeviceId(): Promise<string>;
	registerDevice(): Promise<void>;
	/**
	 * Starts PKCE login. Pass `{ provider: 'google' }` to skip the hosted provider chooser.
	 */
	signIn(options?: AuthorizeOptions): Promise<void>;
	handleCallback(
		urlOrParams: URLSearchParams | string | OAuthRedirectParams,
	): Promise<TokenSet>;
	refresh(): Promise<TokenSet>;
	getAccessToken(): Promise<string | null>;
	signOut(): Promise<void>;
	listDevices(): Promise<Device[]>;
	revokeDevice(deviceId: string): Promise<void>;
	onTokensChanged(cb: (tokens: TokenSet | null) => void): () => void;
	initialize(): Promise<void>;
}
