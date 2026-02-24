import { type Auth, HubProvider, type HubProviderTransferOptions, type ID } from "@baseless/server";

/**
 * Deno WebSocket-backed implementation of {@link HubProvider}.
 *
 * Upgrades incoming HTTP requests to WebSocket connections using
 * `Deno.upgradeWebSocket`, and multiplexes pub/sub topics across
 * all connected sockets.
 */
export class DenoHubProvider extends HubProvider {
	#idleTimeout?: number;
	#websockets: Map<ID<"hub_">, { auth: Auth; socket: WebSocket }>;
	#subscriptions: Map<string, Set<ID<"hub_">>>;

	constructor(idleTimeout?: number) {
		super();
		this.#idleTimeout = idleTimeout;
		this.#websockets = new Map();
		this.#subscriptions = new Map();
	}

	/** Closes all active WebSocket connections and clears all subscriptions. */
	[Symbol.dispose](): void {
		this.#websockets.forEach(({ socket }) => socket.close(1001, "Going away"));
		this.#websockets.clear();
		this.#subscriptions.clear();
	}

	/**
	 * Upgrades the HTTP request to a WebSocket connection via `Deno.upgradeWebSocket`
	 * and begins handling messages for the given hub.
	 * @param options Transfer options including the request, auth, and hub ID.
	 * @returns A `Response` that completes the WebSocket upgrade handshake.
	 */
	override transfer(options: HubProviderTransferOptions): Promise<Response> {
		const { socket, response } = Deno.upgradeWebSocket(options.request, { protocol: "bls", idleTimeout: this.#idleTimeout });
		this.#websockets.set(options.hubId, { auth: options.auth, socket });
		socket.onclose = () => {
			this.#websockets.delete(options.hubId);
			// TODO options.server.handleHubDisconnect(...);
		};
		socket.onmessage = async (event) => {
			try {
				const promises = await options.server.handleHubMessage(options.hubId, options.auth, event.data);
				await Promise.allSettled(promises);
			} catch (_error) {
				socket.close(1003, "Invalid message");
			}
		};
		return Promise.resolve(response);
	}

	/**
	 * Subscribes the hub connection identified by `hubId` to pub/sub `path`.
	 * @param path The topic path.
	 * @param hubId The hub connection ID.
	 * @param _signal Ignored; present for interface compatibility.
	 */
	override subscribe(path: string, hubId: ID<"hub_">, _signal?: AbortSignal): Promise<void> {
		const subscriptions = this.#subscriptions.get(path) ?? new Set();
		subscriptions.add(hubId);
		this.#subscriptions.set(path, subscriptions);
		return Promise.resolve();
	}

	/**
	 * Removes the subscription of `hubId` from pub/sub `path`.
	 * @param path The topic path.
	 * @param hubId The hub connection ID.
	 * @param _signal Ignored; present for interface compatibility.
	 */
	override unsubscribe(path: string, hubId: ID<"hub_">, _signal?: AbortSignal): Promise<void> {
		const subscriptions = this.#subscriptions.get(path);
		if (subscriptions) {
			subscriptions.delete(hubId);
			if (subscriptions.size === 0) {
				this.#subscriptions.delete(path);
			}
		}
		return Promise.resolve();
	}

	/**
	 * Broadcasts `payload` to all hub connections subscribed to `path`.
	 * @param path The topic path.
	 * @param payload The payload to broadcast.
	 * @param _signal Ignored; present for interface compatibility.
	 */
	override publish(path: string, payload: unknown, _signal?: AbortSignal): Promise<void> {
		const subscriptions = this.#subscriptions.get(path);
		if (subscriptions) {
			for (const hubId of subscriptions) {
				const item = this.#websockets.get(hubId);
				if (item) {
					item.socket.send(JSON.stringify({ key: path, payload }));
				}
			}
		}
		return Promise.resolve();
	}
}
