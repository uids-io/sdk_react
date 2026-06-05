import type { AuthReactConfig } from "@uids-io/auth-react";

function requiredEnv(name: keyof ImportMetaEnv): string {
	const value = import.meta.env[name];
	if (!value) {
		throw new Error(`Missing env: ${name}. Copy .env.example to .env`);
	}
	return value;
}

export const authConfig: AuthReactConfig = {
	issuer: requiredEnv("VITE_AUTH_ISSUER"),
	clientId: requiredEnv("VITE_AUTH_CLIENT_ID"),
	redirectUri: requiredEnv("VITE_AUTH_REDIRECT_URI"),
	platform: "web",
	appVersion: "0.0.0-example",
	...(import.meta.env.VITE_AUTH_TOKEN_DELIVERY === "body"
		? { tokenDelivery: "body" as const }
		: {}),
};

/** In dev, default `/api` is proxied to the example API server (see vite.config.ts). */
export const apiBaseUrl =
	import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "/api";
