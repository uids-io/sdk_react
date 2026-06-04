import { beforeEach, describe, expect, it } from "vitest";
import { DeviceStorage } from "../../src/storage/device-storage.js";

describe("DeviceStorage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("returns stable UUID v4 device id", async () => {
		const storage = new DeviceStorage("merchant_portal_web");
		const a = await storage.getDeviceId();
		const b = await storage.getDeviceId();
		expect(a).toBe(b);
		expect(a).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
	});
});
