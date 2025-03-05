type PromiseState = { promise: Promise<unknown>; value?: unknown; expiration?: number };
const map = new Map<unknown, PromiseState>();

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
