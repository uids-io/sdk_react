import type {
	AuthReactConfig,
	DeviceJson,
	DevicePlatform,
	TokenDeliveryMode,
	TokenResponseJson,
} from "../types.js";
import {
	DEVICE_ID_HEADER,
	TOKEN_DELIVERY_COOKIE,
	TOKEN_DELIVERY_HEADER,
} from "./constants.js";
import { parseAuthResponseError } from "./parse-errors.js";

export function normalizeIssuer(issuer: string): string {
	return issuer.replace(/\/+$/, "");
}

export class AuthApi {
	readonly baseUrl: string;

	constructor(
		readonly config: AuthReactConfig,
		private readonly tokenDelivery: TokenDeliveryMode,
	) {
		this.baseUrl = normalizeIssuer(config.issuer);
	}

	private url(path: string): string {
		return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
	}

	private deliveryHeaders(): HeadersInit {
		if (this.tokenDelivery !== "cookie") {
			return {};
		}
		return { [TOKEN_DELIVERY_HEADER]: TOKEN_DELIVERY_COOKIE };
	}

	private async request<T>(
		path: string,
		init: RequestInit & { deviceId?: string; useCredentials?: boolean } = {},
	): Promise<T> {
		const headers = new Headers(init.headers);
		if (!headers.has("Content-Type") && init.body) {
			headers.set("Content-Type", "application/json");
		}
		if (init.deviceId) {
			headers.set(DEVICE_ID_HEADER, init.deviceId);
		}
		for (const [key, value] of Object.entries(this.deliveryHeaders())) {
			headers.set(key, value);
		}

		const { deviceId: _deviceId, useCredentials: _uc, ...fetchInit } = init;

		const response = await fetch(this.url(path), {
			...fetchInit,
			headers,
			credentials:
				this.tokenDelivery === "cookie" || init.useCredentials
					? "include"
					: "same-origin",
		});

		if (!response.ok) {
			throw await parseAuthResponseError(response);
		}

		if (response.status === 204) {
			return undefined as T;
		}

		return (await response.json()) as T;
	}

	registerDevice(body: {
		client_id: string;
		device_id: string;
		platform: DevicePlatform;
		app_version?: string;
	}): Promise<{ device: DeviceJson }> {
		return this.request("/devices/register", {
			method: "POST",
			body: JSON.stringify(body),
		});
	}

	exchangeCode(body: {
		grant_type: "authorization_code";
		code: string;
		client_id: string;
		redirect_uri: string;
		code_verifier: string;
		deviceId: string;
	}): Promise<TokenResponseJson> {
		return this.request("/token", {
			method: "POST",
			deviceId: body.deviceId,
			body: JSON.stringify({
				grant_type: body.grant_type,
				code: body.code,
				client_id: body.client_id,
				redirect_uri: body.redirect_uri,
				code_verifier: body.code_verifier,
			}),
			useCredentials: true,
		});
	}

	refresh(
		refreshToken: string | undefined,
		deviceId: string,
	): Promise<TokenResponseJson> {
		const body =
			refreshToken !== undefined
				? JSON.stringify({ refresh_token: refreshToken })
				: JSON.stringify({});
		return this.request("/refresh", {
			method: "POST",
			deviceId,
			body,
			useCredentials: true,
		});
	}

	logout(refreshToken: string | undefined): Promise<{ success: boolean }> {
		const body =
			refreshToken !== undefined
				? JSON.stringify({ refresh_token: refreshToken })
				: JSON.stringify({});
		return this.request("/logout", {
			method: "POST",
			body,
			useCredentials: true,
		});
	}

	listDevices(accessToken: string): Promise<{ devices: DeviceJson[] }> {
		return this.request("/devices", {
			method: "GET",
			headers: { Authorization: `Bearer ${accessToken}` },
		});
	}

	revokeDevice(
		accessToken: string,
		deviceId: string,
		targetDeviceId: string,
	): Promise<{ success: boolean }> {
		return this.request("/devices/revoke", {
			method: "POST",
			headers: { Authorization: `Bearer ${accessToken}` },
			body: JSON.stringify({ device_id: targetDeviceId }),
			deviceId,
		});
	}
}
