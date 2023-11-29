import type {
	// deno-lint-ignore no-unused-vars
	CounterIncrementError,
	// deno-lint-ignore no-unused-vars
	CounterResetError,
} from "../../counter/errors.ts";

export interface ICounterService {
	/**
	 * @throws {CounterIncrementError}
	 */
	increment(
		key: string[],
		amount: number,
		expiration: number | Date,
	): Promise<number>;

	/**
	 * @throws {CounterResetError}
	 */
	reset(key: string[]): Promise<void>;
}
