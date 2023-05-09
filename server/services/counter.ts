import {
	CounterIncrementError,
	CounterResetError,
} from "../../common/counter/errors.ts";
import { PromisedResult } from "../../common/system/result.ts";
import { CounterProvider } from "../../providers/counter.ts";

export class CounterService {
	#counterProvider: CounterProvider;

	constructor(
		counterProvider: CounterProvider,
	) {
		this.#counterProvider = counterProvider;
	}

	increment(
		key: string,
		amount: number,
		expiration: number | Date,
	): PromisedResult<number, CounterIncrementError> {
		return this.#counterProvider.increment(key, amount, expiration);
	}

	reset(key: string): PromisedResult<void, CounterResetError> {
		return this.#counterProvider.reset(key);
	}
}
