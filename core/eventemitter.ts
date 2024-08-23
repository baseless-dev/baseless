/**
 * Provides methods for listening and emitting events
 */
export class EventEmitter<TEvents extends Record<string, unknown[]> = {}> {
	#handlers: Map<
		keyof TEvents,
		Set<(...args: TEvents[keyof TEvents]) => void | Promise<void>>
	>;
	public constructor();
	public constructor(
		handlers: Map<
			keyof TEvents,
			Set<(...args: TEvents[keyof TEvents]) => void | Promise<void>>
		>,
	);
	public constructor(
		handlers?: Map<
			keyof TEvents,
			Set<(...args: TEvents[keyof TEvents]) => void | Promise<void>>
		>,
	) {
		this.#handlers = new Map(handlers);
	}

	register<
		const TEvent extends string,
		const TArgs extends any[],
	>(): EventEmitter<
		& TEvents
		& {
			[event in TEvent]: TArgs;
		}
	> {
		return new EventEmitter(this.#handlers) as any;
	}

	on<TEvent extends keyof TEvents>(
		event: TEvent,
		handler: (...args: TEvents[TEvent]) => void | Promise<void>,
	): Disposable {
		if (!this.#handlers.has(event)) {
			this.#handlers.set(event, new Set());
		}
		this.#handlers.get(event)!.add(handler as any);
		return {
			[Symbol.dispose]: () => {
				this.#handlers.get(event)!.delete(handler as any);
			},
		};
	}

	async emit<TEvent extends keyof TEvents>(
		event: TEvent,
		...args: TEvents[TEvent]
	): Promise<void> {
		if (!this.#handlers.has(event)) {
			return;
		}
		for (const handler of this.#handlers.get(event)!) {
			await handler(...args);
		}
	}
}

export type ReadonlyEventEmitter<
	TEvents extends Record<string, unknown[]> = {},
> = Pick<EventEmitter<TEvents>, "emit">;
