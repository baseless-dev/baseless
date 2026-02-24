type PromiseState = { promise: Promise<unknown>; value?: unknown; expiration?: number };
const map = new Map<unknown, PromiseState>();

/**
 * Removes all promise-cache entries whose expiration timestamp has elapsed.
 * Call periodically to prevent unbounded memory growth.
 */
export function cleanExpiredKeys(): void {
	const now = Date.now();
	for (const [key, item] of map) {
		if (item.expiration) {
			if (item.expiration < now) {
				map.delete(key);
			}
		}
	}
}

/**
 * Suspense-compatible hook that caches resolved promise values by `key`.
 * On the first render the promise is thrown (triggering `<Suspense>`); on
 * subsequent renders the cached value is returned synchronously.
 *
 * @param key Cache key — the promise is re-created when this changes.
 * @param initialValue The value or factory to resolve on a cache miss.
 * @param expiration How long (ms), a `Date`, or a factory that returns the
 * expiry for the resolved value. Omit for no expiration.
 * @returns The resolved value.
 */
export function useKeyedPromise<T extends unknown>(
	key: unknown,
	initialValue: T | (() => T | Promise<T>),
	expiration?: number | Date | ((value: T) => number | Date | Promise<number | Date>),
): T {
	let item = map.get(key);
	if (!item || ("expiration" in item && item.expiration && item.expiration <= Date.now())) {
		const promise = Promise.resolve(initialValue instanceof Function ? initialValue() : initialValue)
			.then((value) => {
				item!.value = value;
				if (typeof expiration === "function") {
					return expiration(value);
				}
				return expiration;
			});
		item = { promise };
		map.set(key, item);
	}
	if (!("value" in item)) {
		throw item.promise;
	}
	return item.value as never;
}

export default useKeyedPromise;
