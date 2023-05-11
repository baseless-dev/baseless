// deno-lint-ignore no-unused-vars
import type { CounterIncrementError, CounterResetError } from "../../counter/errors.ts";

export interface ICounterService {
	/**
	 * @throws {CounterIncrementError}
	 */
	increment(
		key: string,
		amount: number,
		expiration: number | Date,
	): Promise<number>;

	/**
	 * @throws {CounterResetError}
	 */
	reset(key: string): Promise<void>;
}