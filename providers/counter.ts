// deno-lint-ignore no-unused-vars
import type {
	CounterIncrementError,
	CounterResetError,
} from "../common/counter/errors.ts";

/**
 * Counter Provider
 */
export interface CounterProvider {
	/**
	 * Increment counter for key by some amount
	 * @throws {CounterIncrementError}
	 */
	increment(
		key: string,
		amount: number,
		expiration?: number | Date,
	): Promise<number>;

	/**
	 * Reset counter for key
	 * @throws {CounterResetError}
	 */
	reset(key: string): Promise<void>;
}
