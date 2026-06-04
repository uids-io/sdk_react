import { deviceStorageKey } from "./keys.js";

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateUuidV4(): string {
	const bytes = new Uint8Array(16);

	crypto.getRandomValues(bytes);

	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
		"",
	);

	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type DeviceStorageBackend = "localStorage" | "indexedDB";

export class DeviceStorage {
	constructor(
		private readonly clientId: string,
		private readonly backend: DeviceStorageBackend = "localStorage",
	) {}

	private key(): string {
		return deviceStorageKey(this.clientId);
	}

	async getDeviceId(): Promise<string> {
		const existing = await this.read();

		if (existing && UUID_RE.test(existing)) {
			return existing;
		}

		const id = generateUuidV4();
		await this.write(id);

		return id;
	}

	private async read(): Promise<string | null> {
		if (this.backend === "localStorage") {
			return localStorage.getItem(this.key());
		}

		return readIndexedDb(this.key());
	}

	private async write(value: string): Promise<void> {
		if (this.backend === "localStorage") {
			localStorage.setItem(this.key(), value);
			return;
		}
		await writeIndexedDb(this.key(), value);
	}
}

const IDB_NAME = "uids-auth-react";
const IDB_STORE = "kv";

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(IDB_NAME, 1);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = () => {
			const db = request.result;

			if (!db.objectStoreNames.contains(IDB_STORE)) {
				db.createObjectStore(IDB_STORE);
			}
		};
	});
}

async function readIndexedDb(key: string): Promise<string | null> {
	const db = await openDb();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE, "readonly");
		const store = tx.objectStore(IDB_STORE);
		const req = store.get(key);

		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
	});
}

async function writeIndexedDb(key: string, value: string): Promise<void> {
	const db = await openDb();

	return new Promise((resolve, reject) => {
		const tx = db.transaction(IDB_STORE, "readwrite");
		const store = tx.objectStore(IDB_STORE);
		const req = store.put(value, key);

		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve();
	});
}
