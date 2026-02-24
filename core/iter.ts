/**
 * Returns the first value from an iterator, advancing it by one step.
 * @param iter The iterator to consume.
 * @returns The first yielded value.
 * @throws {Error} When the iterator is already done (empty).
 */
export function first<T, TReturn, TNext>(
	iter: IterableIterator<T, TReturn, TNext>,
): T {
	const { value, done } = iter.next();
	if (done) {
		throw new Error("expected at least one value");
	}
	return value;
}
