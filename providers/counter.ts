import { CounterIncrementError, CounterResetError } from "../common/counter/errors.ts";
import { PromisedResult } from "../common/system/result.ts";

/**
 * Counter Provider
 */
export interface CounterProvider {
	/**
	 * Increment counter for key by some amount
	 */
	increment(
		key: string,
		amount: number,
		expiration?: number | Date,
	): PromisedResult<number, CounterIncrementError>;

	/**
	 * Reset counter for key
	 */
	reset(key: string): PromisedResult<void, CounterResetError>;
}
