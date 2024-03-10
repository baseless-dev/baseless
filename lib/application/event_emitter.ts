import type { EventEmitter, ReadonlyEventEmitter } from "../event_emitter.ts";

export class ContextualizedEventEmitter
	implements ReadonlyEventEmitter<Record<string, any[]>> {
	#context: Record<string, unknown>;
	#eventEmitter: EventEmitter<Record<string, any[]>>;
	constructor(context: Record<string, unknown>, eventEmitter: EventEmitter) {
		this.#context = context;
		this.#eventEmitter = eventEmitter;
	}

	emit(
		event: string,
		...args: unknown[]
	): Promise<void> {
		return this.#eventEmitter.emit(event, this.#context, ...args);
	}
}
