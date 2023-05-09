// deno-lint-ignore no-unused-vars
import type {
	CounterIncrementError,
	CounterResetError,
} from "../../common/counter/errors.ts";
import { CounterProvider } from "../../providers/counter.ts";

export class CounterService {
	#counterProvider: CounterProvider;

	constructor(
		counterProvider: CounterProvider,
	) {
		this.#counterProvider = counterProvider;
	}

	/**
	 * @throws {CounterIncrementError}
	 */
	increment(
		key: string,
		amount: number,
		expiration: number | Date,
	): Promise<number> {
		return this.#counterProvider.increment(key, amount, expiration);
	}

	/**
	 * @throws {CounterResetError}
	 */
	reset(key: string): Promise<void> {
		return this.#counterProvider.reset(key);
	}
}
