/**
 * Counter Provider
 */
export interface CounterProvider {
	/**
	 * Increment counter for key by some amount
	 */
	increment(
		key: string[],
		amount: number,
		expiration?: number | Date,
	): Promise<number>;

	/**
	 * Reset counter for key
	 */
	reset(key: string[]): Promise<void>;
}

/**
 * Return a sliding window counter
 * @param interval Interval in seconds
 * @returns
 */
export function slidingWindow(interval: number): number {
	return Math.round(Date.now() / interval * 1000);
}
