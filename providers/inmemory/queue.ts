// deno-lint-ignore-file no-this-alias
import { type QueueItem, QueueProvider } from "@baseless/server";

export class MemoryQueueProvider extends QueueProvider {
	#queue: Array<QueueItem> = [];
	#writers: Map<number, { stream: WritableStream<QueueItem>; writer: WritableStreamDefaultWriter<QueueItem> }> = new Map();
	#id = 0;

	[Symbol.dispose](): void {
		for (const { stream, writer } of this.#writers.values()) {
			writer.releaseLock();
			stream.abort();
		}
		this.#queue.splice(0);
		this.#writers.clear();
	}

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
