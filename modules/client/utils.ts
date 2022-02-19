/**
 * Provides methods for listening and emitting events
 */
export class EventEmitter<T extends unknown[] | []> {
	/**
	 * Construct an `EventEmitter` object
	 */
	public constructor(
		protected handlers: Set<(...args: T) => void> = new Set(),
	) {}

	/**
	 * Add `handler` to the listeners set and returns a disposable delegate
	 */
	public listen(handler: (...args: T) => void) {
		this.handlers.add(handler);
		return () => {
			this.handlers.delete(handler);
		};
	}

	/**
	 * Emit a new event to the listeners
	 */
	public emit(...args: T) {
		for (const handler of this.handlers) {
			handler(...args);
		}
	}

	/**
	 * Clear the listeners set
	 */
	public clear() {
		this.handlers.clear();
	}
}

/**
 * Provides methods for deffering a promise
 */
export class Deferred<T = unknown> {
	public readonly promise: Promise<T>;

	private _resolve!: (value: T) => void;
	private _reject!: (reason?: unknown) => void;

	public constructor() {
		this.promise = new Promise((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
	}

	public resolve(value: T) {
		this._resolve(value);
	}

	public reject(reason?: unknown) {
		this._reject(reason);
	}
}

/**
 * Provides methods for locking and waiting on a promise
 */
export class Lock {
	private deferred?: Deferred<void>;

	public constructor() {}

	public get isLock() {
		return !!this.deferred;
	}

	public get waiter() {
		return this.deferred?.promise;
	}

	public lock() {
		if (!this.deferred) {
			this.deferred = new Deferred();
		}
	}

	public unlock() {
		this.deferred?.resolve();
		this.deferred = undefined;
	}
}
