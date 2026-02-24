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

	/** Remove all registered event listeners. */
	clear(): void {
		this.#listeners.clear();
	}

	/**
	 * Checks whether any listener is registered for the given `event`.
	 * @param event The event name to query.
	 * @returns `true` if at least one listener is registered.
	 */
	hasListener(event: keyof TEvents): boolean {
		return this.#listeners.has(event);
	}

	/**
	 * Registers a handler for the given `event` and returns a `Disposable`
	 * that removes it when disposed.
	 * @param event The event name to listen to.
	 * @param handler Callback invoked whenever the event is emitted.
	 * @returns A {@link Disposable} — call `[Symbol.dispose]()` or use `using` to unsubscribe.
	 */
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

	/**
	 * Returns a {@link ReadableStream} that yields every value emitted for
	 * `event`. The stream automatically unsubscribes when cancelled.
	 * @param event The event name to stream.
	 * @returns A `ReadableStream` of event payloads.
	 */
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

	/**
	 * Invokes all handlers registered for `event` in registration order,
	 * awaiting each one before calling the next.
	 * @param event The event name to emit.
	 * @param arg The payload to pass to each handler.
	 */
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

/**
 * A read-only view of {@link EventEmitter} that exposes only `emit`.
 * Share this type with producers that should not be able to register or
 * clear listeners.
 */
export type ReadonlyEventEmitter<
	TEvents extends Record<string, unknown[]> = {},
> = Pick<EventEmitter<TEvents>, "emit">;
