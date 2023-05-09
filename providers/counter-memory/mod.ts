import { CacheMap } from "../../common/collections/cachemap.ts";
import { CounterProvider } from "../counter.ts";

export class MemoryCounterProvider implements CounterProvider {
	#keys: CacheMap<string, number>;
	constructor() {
		this.#keys = new CacheMap();
	}

	increment(
		key: string,
		amount: number,
		expiration?: number | Date,
	): Promise<number> {
		amount += this.#keys.get(key) ?? 0;
		if (amount > 0) {
			this.#keys.set(key, amount, expiration);
		}
		return Promise.resolve(amount);
	}

	reset(key: string): Promise<void> {
		this.#keys.delete(key);
		return Promise.resolve();
	}
}
