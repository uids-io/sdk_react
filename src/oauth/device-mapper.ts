import type { Device, DeviceJson } from "../types.js";

export function mapDevice(json: DeviceJson): Device {
	return {
		deviceId: json.deviceId,
		clientId: json.clientId,
		platform: json.platform,
		platformVersion: json.platformVersion,
		appVersion: json.appVersion,
		deviceName: json.deviceName,
		status: json.status,
		lastSeenAt:
			typeof json.lastSeenAt === "string"
				? json.lastSeenAt
				: new Date(json.lastSeenAt).toISOString(),
	};
}
