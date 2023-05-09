export class CounterIncrementError extends Error {
	name = "CounterIncrementError" as const;
}
export class CounterResetError extends Error {
	name = "CounterResetError" as const;
}
