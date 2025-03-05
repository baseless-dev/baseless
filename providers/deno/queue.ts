import { QueueItem, QueueProvider } from "@baseless/server";

export class DenoQueueProvider extends QueueProvider {
	#storage: Deno.Kv;
	constructor(storage: Deno.Kv) {
		super();
		this.#storage = storage;
	}

	async enqueue(item: QueueItem, _signal?: AbortSignal): Promise<void> {
		await this.#storage.enqueue(item);
	}

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
