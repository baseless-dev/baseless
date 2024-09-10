type PromiseState<T> = { promise: Promise<unknown>; value?: T; expiration?: number };
const map = new Map<any, PromiseState<unknown>>();
let timer: number | undefined;

function cleanExpiredKeys(): void {
	const now = Date.now();
	let hasExpiringKeys = false;
	for (const [key, item] of map) {
		if (item.expiration) {
			if (item.expiration < now) {
				map.delete(key);
			} else {
				hasExpiringKeys = true;
			}
		}
	}
	timer = hasExpiringKeys ? setTimeout(cleanExpiredKeys, 10000) : undefined;
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
				return undefined;
			})
			.then((expiration) => {
				item!.expiration = expiration instanceof Date ? expiration.getTime() : expiration;
				if (item!.expiration && timer === undefined) {
					timer = setTimeout(cleanExpiredKeys, 10000);
				}
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
