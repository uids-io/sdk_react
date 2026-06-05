import { OAuthError } from "../errors.js";
import { buildAuthorizeUrl } from "../oauth/authorize-url.js";
import { isProviderEnabled } from "../oauth/providers.js";
import { generatePkcePair } from "../pkce.js";
import type { DeviceStorage } from "../storage/device-storage.js";
import type { OAuthRedirectStorage } from "../storage/oauth-redirect-storage.js";
import type {
	AuthorizeOptions,
	AuthProvidersResponse,
	AuthReactConfig,
} from "../types.js";

export interface SignInContext {
	config: AuthReactConfig;
	deviceStorage: DeviceStorage;
	redirectStorage: OAuthRedirectStorage;
	getProviders: () => Promise<AuthProvidersResponse>;
	registerDevice: () => Promise<void>;
}

function randomState(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function startSignIn(
	ctx: SignInContext,
	options?: AuthorizeOptions,
): Promise<void> {
	const {
		config,
		deviceStorage,
		redirectStorage,
		getProviders,
		registerDevice,
	} = ctx;

	if (options?.provider) {
		const providers = await getProviders();

		if (!isProviderEnabled(providers, options.provider)) {
			throw new OAuthError(
				"provider_not_configured",
				`Login provider "${options.provider}" is not enabled on the auth server`,
			);
		}
	}

	await registerDevice();
	const deviceId = await deviceStorage.getDeviceId();
	const pkce = await generatePkcePair();

	const state = options?.state ?? randomState();

	redirectStorage.start(pkce.verifier, state);

	const url = buildAuthorizeUrl({
		config,
		pkce,
		deviceId,
		state,
		options,
	});

	window.location.assign(url);
}
