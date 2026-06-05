import type { TokenSet } from "../types.js";

const CHANNEL_NAME = "uids-auth-react";

export type TabMessage =
	| { type: "tokens-updated"; tokens: TokenSet; clientId: string }
	| { type: "session-cleared"; clientId: string }
	| { type: "session-request"; clientId: string };

/**
 * Coordinates refresh across browser tabs to avoid refresh-token rotation races.
 *
 * Only one tab performs `POST /refresh` at a time (`navigator.locks`); the leader
 * broadcasts the new access token to other tabs via `BroadcastChannel`.
 *
 * @see docs/TOKEN_STORAGE.md
 */
export class TabCoordinator {
	private channel: BroadcastChannel | null = null;
	private readonly listeners = new Set<(msg: TabMessage) => void>();

	constructor(private readonly clientId: string) {
		if (typeof BroadcastChannel !== "undefined") {
			this.channel = new BroadcastChannel(CHANNEL_NAME);
			this.channel.onmessage = (event: MessageEvent<TabMessage>) => {
				const data = event.data;
				if (data?.clientId !== this.clientId) {
					return;
				}

				for (const cb of this.listeners) {
					cb(data);
				}
			};
		}
	}

	subscribe(handler: (msg: TabMessage) => void): () => void {
		this.listeners.add(handler);

		return () => this.listeners.delete(handler);
	}

	broadcast(message: TabMessage): void {
		this.channel?.postMessage(message);
	}

	/**
	 * Asks other tabs for the current access token (avoids refresh when opening a new tab).
	 */
	requestTokensFromOtherTabs(timeoutMs = 200): Promise<TokenSet | null> {
		if (!this.channel) {
			return Promise.resolve(null);
		}

		return new Promise((resolve) => {
			const onMessage = (event: MessageEvent<TabMessage>) => {
				const data = event.data;
				if (
					data?.clientId === this.clientId &&
					data.type === "tokens-updated" &&
					data.tokens.accessToken
				) {
					cleanup();
					resolve(data.tokens);
				}
			};

			const cleanup = (): void => {
				clearTimeout(timer);
				this.channel?.removeEventListener("message", onMessage);
			};

			const timer = setTimeout(() => {
				cleanup();
				resolve(null);
			}, timeoutMs);

			this.channel?.addEventListener("message", onMessage);
			this.broadcast({ type: "session-request", clientId: this.clientId });
		});
	}

	/**
	 * Runs `fn` under a cross-tab lock so only one refresh executes at a time.
	 */
	async withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
		if (typeof navigator !== "undefined" && navigator.locks?.request) {
			return navigator.locks.request(`uids-auth-refresh:${this.clientId}`, fn);
		}
		return fn();
	}

	close(): void {
		this.channel?.close();
		this.channel = null;
		this.listeners.clear();
	}
}
