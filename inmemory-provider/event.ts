import { EventProvider } from "@baseless/server/event-provider";
import type { HubProvider } from "@baseless/server/hub-provider";
import type { ID } from "@baseless/core/id";
import type { Event } from "@baseless/core/event";

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

export class MemoryEventProvider extends EventProvider {
	#subscribers = new Map<string, Set<ID<"hub_">>>();
	#hub: HubProvider;

	constructor(hub: HubProvider) {
		super();
		this.#hub = hub;
	}

	publish(key: string[], payload: unknown): Promise<void> {
		const subscribers = this.#subscribers.get(keyPathToKeyString(key));
		const event: Event = { kind: "event", event: key, payload };
		const eventString = JSON.stringify(event);
		if (subscribers) {
			for (const hubId of subscribers) {
				this.#hub.sendToHub(hubId, eventString);
			}
		}
		return Promise.resolve();
	}

	subscribe(key: string[], hubId: ID<"hub_">): Promise<void> {
		const keyString = keyPathToKeyString(key);
		this.#subscribers.set(keyString, (this.#subscribers.get(keyString) ?? new Set()).add(hubId));
		return Promise.resolve();
	}

	unsubscribe(key: string[], hubId: ID<"hub_">): Promise<void> {
		const subscribers = this.#subscribers.get(keyPathToKeyString(key));
		if (subscribers) {
			subscribers.delete(hubId);
		}
		return Promise.resolve();
	}

	unsubscribeAll(hubId: ID<"hub_">): Promise<void> {
		for (const subscribers of this.#subscribers.values()) {
			subscribers.delete(hubId);
		}
		return Promise.resolve();
	}
}
