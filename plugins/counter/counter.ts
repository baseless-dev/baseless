import type { CounterProvider } from "../../providers/counter.ts";

export class CounterService {
	#counterProvider: CounterProvider;

	constructor(
		counterProvider: CounterProvider,
	) {
		this.#counterProvider = counterProvider;
	}

	increment(
		key: string[],
		amount: number,
		expiration: number | Date,
	): Promise<number> {
		return this.#counterProvider.increment(key, amount, expiration);
	}

	reset(key: string[]): Promise<void> {
		return this.#counterProvider.reset(key);
	}
}
