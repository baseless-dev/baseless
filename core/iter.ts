export function first<T, TReturn, TNext>(
	iter: IterableIterator<T, TReturn, TNext>,
): T {
	const { value, done } = iter.next();
	if (done) {
		throw new Error("expected at least one value");
	}
	return value;
}
