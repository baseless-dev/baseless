import { QueueItem, QueueProvider } from "@baseless/server";

export class MemoryQueueProvider extends QueueProvider {
	#queue: Array<QueueItem>;

	constructor() {
		super();
		this.#queue = [];
	}

	[Symbol.dispose](): void {
		this.#queue.splice(0, this.#queue.length);
	}

	get queue(): ReadonlyArray<QueueItem> {
		return [...this.#queue];
	}

	enqueue(item: QueueItem, _signal?: AbortSignal): Promise<void> {
		this.#queue.push(item);
		return Promise.resolve();
	}

	dequeue(signal?: AbortSignal): ReadableStream<QueueItem> {
		const queue = this.#queue;
		return new ReadableStream<QueueItem>({
			pull(controller): void {
				if (signal?.aborted) {
					controller.close();
					return;
				}
				const item = queue.shift();
				if (item) {
					controller.enqueue(item);
				}
			},
		});
	}
}
