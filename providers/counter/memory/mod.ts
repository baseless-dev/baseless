import { CacheMap } from "../../../lib/cachemap.ts";
import type { CounterProvider } from "../provider.ts";

function keyPathToKeyString(key: string[]): string {
	return key.map((p) => p.replaceAll("/", "\\/")).join("/");
}

export class MemoryCounterProvider implements CounterProvider {
	#keys: CacheMap<string, number>;
	constructor() {
		this.#keys = new CacheMap();
	}

	increment(
		key: string[],
		amount: number,
		expiration?: number | Date,
	): Promise<number> {
		const keyString = keyPathToKeyString(key);
		amount += this.#keys.get(keyString) ?? 0;
		if (amount > 0) {
			this.#keys.set(keyString, amount, expiration);
		}
		return Promise.resolve(amount);
	}

	reset(key: string[]): Promise<void> {
		const keyString = keyPathToKeyString(key);
		this.#keys.delete(keyString);
		return Promise.resolve();
	}
}
