import { HubProvider } from "@baseless/server/hub-provider";
import { type ID, id } from "@baseless/core/id";
import type { Context } from "@baseless/server/types";
import {
	isCommandCollectionUnwatch,
	isCommandCollectionWatch,
	isCommandDocumentUnwatch,
	isCommandDocumentWatch,
	isCommandEventPublish,
	isCommandEventSubscribe,
	isCommandEventUnsubscribe,
} from "@baseless/core/command";

export class DenoHubProvider extends HubProvider {
	#socketMap = new Map<ID<"hub_">, { socket: WebSocket }>();

	sendToHub(hubId: ID<"hub_">, data: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void> {
		const { socket } = this.#socketMap.get(hubId) ?? {};
		// TODO isEvent, begin with $collection, filter out before/after
		socket?.send(data);
		return Promise.resolve();
	}

	transfer(request: Request, context: Context): Promise<Response> {
		const { response, socket } = Deno.upgradeWebSocket(request);
		const abortController = new AbortController();
		const hubId = id("hub_");

		this.#socketMap.set(hubId, { socket });
		abortController.signal.addEventListener("abort", async () => {
			await context.event.unsubscribeAll(hubId);
			this.#socketMap.delete(hubId);
			await context.hub.disconnectHub(hubId);
		}, { once: true });

		socket.addEventListener("open", async () => {
			await context.hub.connectHub(hubId);
		}, { signal: abortController.signal });
		socket.addEventListener("error", (e) => {
			// console.log("server:onerror", e);
		}, { signal: abortController.signal });
		socket.addEventListener("close", () => {
			abortController.abort();
		}, { signal: abortController.signal });
		socket.addEventListener("message", async ({ data }) => {
			try {
				const command = JSON.parse(data.toString());
				if (isCommandEventPublish(command)) {
					await context.event.publish(command.event, command.payload);
				} else if (isCommandEventSubscribe(command)) {
					await context.event.subscribe(command.event, hubId);
				} else if (isCommandEventUnsubscribe(command)) {
					await context.event.unsubscribe(command.event, hubId);
				} else if (isCommandDocumentWatch(command)) {
					await context.event.subscribe(["$document", ...command.key], hubId);
				} else if (isCommandDocumentUnwatch(command)) {
					await context.event.unsubscribe(["$document", ...command.key], hubId);
				} else if (isCommandCollectionWatch(command)) {
					// TODO before/after
					await context.event.subscribe(["$collection", ...command.key], hubId);
				} else if (isCommandCollectionUnwatch(command)) {
					// TODO before/after
					await context.event.unsubscribe(["$collection", ...command.key], hubId);
				}
				// deno-lint-ignore no-empty
			} catch (_error) {}
		}, { signal: abortController.signal });

		return Promise.resolve(response);
	}
}
