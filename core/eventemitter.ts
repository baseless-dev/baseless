// deno-lint-ignore-file no-explicit-any ban-types
/**
 * Provides methods for listening and emitting events
 */
export class EventEmitter<TEvents extends Record<string, unknown[]> = {}> {
	#listeners: Map<
		keyof TEvents,
		Set<(...args: TEvents[keyof TEvents]) => void | Promise<void>>
	>;
	public constructor();
	public constructor(
		listeners: Map<
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
		this.#listeners = new Map(handlers);
	}

	listeners(): Map<string, ReadonlySet<(...args: any[]) => void | Promise<void>>> {
		return new Map(this.#listeners) as never;
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
		return new EventEmitter(this.#listeners) as any;
	}

	on<TEvent extends keyof TEvents>(
		event: TEvent,
		handler: (...args: TEvents[TEvent]) => void | Promise<void>,
	): Disposable {
		if (!this.#listeners.has(event)) {
			this.#listeners.set(event, new Set());
		}
		this.#listeners.get(event)!.add(handler as any);
		return {
			[Symbol.dispose]: () => {
				this.#listeners.get(event)!.delete(handler as any);
			},
		};
	}

	async emit<TEvent extends keyof TEvents>(
		event: TEvent,
		...args: TEvents[TEvent]
	): Promise<void> {
		if (!this.#listeners.has(event)) {
			return;
		}
		for (const handler of this.#listeners.get(event)!) {
			await handler(...args);
		}
	}
}

export type ReadonlyEventEmitter<
	TEvents extends Record<string, unknown[]> = {},
> = Pick<EventEmitter<TEvents>, "emit">;
