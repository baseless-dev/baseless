import { CacheMap } from "../../../shared/cachemap.ts";
import { CounterProvider } from "../counter.ts";

export class MemoryCounterProvider implements CounterProvider {
	#keys: CacheMap<string, number>;
	constructor() {
		this.#keys = new CacheMap();
	}

	increment(key: string, amount: number, expireInAt?: number | Date): Promise<number> {
		amount += this.#keys.get(key) ?? 0;
		if (amount > 0) {
			this.#keys.set(key, amount, expireInAt);
		}
		return Promise.resolve(amount);
	}

	reset(key: string): Promise<void> {
		this.#keys.delete(key);
		return Promise.resolve();
	}
}
