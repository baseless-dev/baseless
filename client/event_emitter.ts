// deno-lint-ignore-file no-explicit-any ban-types
/**
 * Provides methods for listening and emitting events
 */
export class EventEmitter<TEvents extends Record<string, unknown> = {}> implements Disposable {
	#listeners: Map<
		keyof TEvents,
		Set<(arg: TEvents[keyof TEvents]) => void | Promise<void>>
	>;
	public constructor();
	public constructor(
		listeners: Map<
			keyof TEvents,
			Set<(arg: TEvents[keyof TEvents]) => void | Promise<void>>
		>,
	);
	public constructor(
		handlers?: Map<
			keyof TEvents,
			Set<(arg: TEvents[keyof TEvents]) => void | Promise<void>>
		>,
	) {
		this.#listeners = new Map(handlers);
	}

	[Symbol.dispose](): void {
		this.clear();
	}

	clear(): void {
		this.#listeners.clear();
	}

	hasListener(event: keyof TEvents): boolean {
		return this.#listeners.has(event);
	}

	on<TEvent extends keyof TEvents>(
		event: TEvent,
		handler: (arg: TEvents[TEvent]) => void | Promise<void>,
	): Disposable {
		if (!this.#listeners.has(event)) {
			this.#listeners.set(event, new Set());
		}
		this.#listeners.get(event)!.add(handler as any);
		return {
			[Symbol.dispose]: () => {
				this.#listeners.get(event)?.delete(handler as any);
				if (this.#listeners.get(event)?.size === 0) {
					this.#listeners.delete(event);
				}
			},
		};
	}

	stream<TEvent extends keyof TEvents>(event: TEvent): ReadableStream<TEvents[TEvent]> {
		let controller: ReadableStreamDefaultController<TEvents[TEvent]> | undefined;
		const listener = this.on(event, (arg) => {
			controller?.enqueue(arg);
		});
		const stream = new ReadableStream<TEvents[TEvent]>({
			start(c): void {
				controller = c;
			},
			cancel(): void {
				listener[Symbol.dispose]();
			},
		});
		return stream;
	}

	async emit<TEvent extends keyof TEvents>(
		event: TEvent,
		arg: TEvents[TEvent],
	): Promise<void> {
		if (!this.#listeners.has(event)) {
			return;
		}
		for (const handler of this.#listeners.get(event)!) {
			await handler(arg);
		}
	}
}

export type ReadonlyEventEmitter<
	TEvents extends Record<string, unknown[]> = {},
> = Pick<EventEmitter<TEvents>, "emit">;
