import { type QueueItem, QueueProvider } from "@baseless/server";

/**
 * Deno KV-backed implementation of {@link QueueProvider}.
 *
 * Enqueues items using the `Deno.Kv.enqueue` API and delivers them
 * via `Deno.Kv.listenQueue` on the dequeue stream.
 */
export class DenoQueueProvider extends QueueProvider {
	#storage: Deno.Kv;
	constructor(storage: Deno.Kv) {
		super();
		this.#storage = storage;
	}

	/**
	 * Adds `item` to the queue using `Deno.Kv.enqueue`.
	 * @param item The item to enqueue.
	 * @param _signal Ignored; present for interface compatibility.
	 */
	async enqueue(item: QueueItem, _signal?: AbortSignal): Promise<void> {
		await this.#storage.enqueue(item);
	}

	/**
	 * Returns a stream that emits dequeued items via `Deno.Kv.listenQueue`.
	 * @param _signal Ignored; present for interface compatibility.
	 * @returns A `ReadableStream` of {@link QueueItem} values.
	 */
	dequeue(_signal?: AbortSignal): ReadableStream<QueueItem> {
		const storage = this.#storage;
		return new ReadableStream<QueueItem>({
			start(controller): void {
				storage.listenQueue((msg: unknown) => {
					const item = msg as QueueItem;
					controller.enqueue(item);
				});
			},
		});
	}
}
