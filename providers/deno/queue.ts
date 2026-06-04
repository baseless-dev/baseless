import { type QueueItem, QueueProvider } from "@baseless/server";
import tracer from "./tracer.ts";

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
	 * @param _options Ignored; present for interface compatibility.
	 */
	async enqueue(item: QueueItem, _options?: { signal?: AbortSignal }): Promise<void> {
		return tracer.startActiveSpan("@baseless/deno-provider.queue.enqueue", async (span) => {
			span.setAttribute("queue_item.key", item.key);
			span.setAttribute("queue_item.type", item.type);
			try {
				await this.#storage.enqueue(item);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	/**
	 * Returns a stream that emits dequeued items via `Deno.Kv.listenQueue`.
	 * @param _options Ignored; present for interface compatibility.
	 * @returns A `ReadableStream` of {@link QueueItem} values.
	 */
	dequeue(_options?: { signal?: AbortSignal }): ReadableStream<QueueItem> {
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
