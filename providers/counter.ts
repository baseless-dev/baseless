import {
	CounterIncrementError,
	CounterResetError,
} from "../common/counter/errors.ts";
import { Result } from "../common/system/result.ts";

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
	): Promise<Result<number, CounterIncrementError>>;

	/**
	 * Reset counter for key
	 */
	reset(key: string): Promise<Result<void, CounterResetError>>;
}
