/**
 * Provides methods for listening and emitting events
 */
export class EventEmitter<T extends unknown[] = []> {
	/**
	 * Construct an `EventEmitter` object
	 */
	public constructor(
		protected handlers: Set<(...args: T) => void> = new Set(),
	) {}

	/**
	 * Add `handler` to the listeners set and returns a disposable delegate
	 */
	public listen(handler: (...args: T) => void): () => void {
		this.handlers.add(handler);
		return () => {
			this.handlers.delete(handler);
		};
	}

	/**
	 * Emit a new event to the listeners
	 */
	public emit(...args: T): void {
		for (const handler of this.handlers) {
			handler(...args);
		}
	}

	/**
	 * Clear the listeners set
	 */
	public clear(): void {
		this.handlers.clear();
	}
}
