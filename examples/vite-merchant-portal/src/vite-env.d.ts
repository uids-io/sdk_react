/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_AUTH_ISSUER: string;
	readonly VITE_AUTH_CLIENT_ID: string;
	readonly VITE_AUTH_REDIRECT_URI: string;
	readonly VITE_API_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
