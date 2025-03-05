import { Auth, HubProvider, HubProviderTransferOptions, type ID } from "@baseless/server";

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

	[Symbol.dispose](): void {
		this.#websockets.forEach(({ socket }) => socket.close(1001, "Going away"));
		this.#websockets.clear();
		this.#subscriptions.clear();
	}

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

	override subscribe(key: string, hubId: ID<"hub_">, _signal?: AbortSignal): Promise<void> {
		const subscriptions = this.#subscriptions.get(key) ?? new Set();
		subscriptions.add(hubId);
		this.#subscriptions.set(key, subscriptions);
		return Promise.resolve();
	}

	override unsubscribe(key: string, hubId: ID<"hub_">, _signal?: AbortSignal): Promise<void> {
		const subscriptions = this.#subscriptions.get(key);
		if (subscriptions) {
			subscriptions.delete(hubId);
			if (subscriptions.size === 0) {
				this.#subscriptions.delete(key);
			}
		}
		return Promise.resolve();
	}

	override publish(key: string, payload: unknown, _signal?: AbortSignal): Promise<void> {
		const subscriptions = this.#subscriptions.get(key);
		if (subscriptions) {
			for (const hubId of subscriptions) {
				const item = this.#websockets.get(hubId);
				if (item) {
					item.socket.send(JSON.stringify({ key, payload }));
				}
			}
		}
		return Promise.resolve();
	}
}
