// deno-lint-ignore-file no-this-alias
import { type QueueItem, QueueProvider } from "@baseless/server";

/**
 * In-memory implementation of {@link QueueProvider}.
 *
 * Buffers {@link QueueItem} objects in an in-memory array and delivers them
 * to active dequeue streams.  Suitable for unit tests and single-process
 * servers; items are lost on process exit.
 */
export class MemoryQueueProvider extends QueueProvider {
	#queue: Array<QueueItem> = [];
	#writers: Map<number, { stream: WritableStream<QueueItem>; writer: WritableStreamDefaultWriter<QueueItem> }> = new Map();
	#id = 0;

	/** Aborts all active dequeue streams and clears buffered items. */
	[Symbol.dispose](): void {
		for (const { stream, writer } of this.#writers.values()) {
			writer.releaseLock();
			stream.abort();
		}
		this.#queue.splice(0);
		this.#writers.clear();
	}

	/**
	 * Adds `item` to the queue for delivery to active dequeue streams.
	 *
	 * If no stream is currently dequeuing, the item is buffered and will be
	 * flushed to the next caller of {@link dequeue}.
	 * @param item The item to enqueue.
	 * @param _signal Ignored; present for interface compatibility.
	 */
	enqueue(item: QueueItem, _signal?: AbortSignal): Promise<void> {
		// If no writer, buffer items
		if (this.#writers.size === 0) {
			this.#queue.push(item);
		} else {
			for (const { writer } of this.#writers.values()) {
				writer.write(item);
			}
		}
		return Promise.resolve();
	}

	/**
	 * Returns a `ReadableStream` that emits dequeued items as they arrive.
	 *
	 * Any items buffered before this call are flushed immediately.  Multiple
	 * concurrent streams each receive every enqueued item.
	 * @param signal Optional abort signal to close the stream.
	 * @returns A `ReadableStream` of {@link QueueItem} values.
	 */
	dequeue(signal?: AbortSignal): ReadableStream<QueueItem> {
		const _this = this;
		const id = this.#id++;
		const { readable, writable } = new TransformStream<QueueItem>({
			cancel(): void {
				_this.#writers.delete(id);
			},
		});
		const writer = writable.getWriter();
		this.#writers.set(id, { stream: writable, writer });

		// Immediately flush any queued items
		let item: QueueItem | undefined;
		while ((item = this.#queue.shift())) {
			writer.write(item);
		}

		signal?.addEventListener("abort", () => {
			writer.releaseLock();
			writable.abort();
		});

		return readable;
	}
}
