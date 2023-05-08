export type ResultOk<Value> = { kind: "ok"; value: Value };
export type ResultError<Error> = { kind: "error"; error: Error };

export type Result<Value, Error> =
	| ResultOk<Value>
	| ResultError<Error>;

export type PromisedResult<Value, Error> = Promise<Result<Value, Error>>;

export function ok(): ResultOk<undefined>
export function ok<Value>(value: Value): ResultOk<Value>
export function ok<Value>(value?: Value): ResultOk<Value | undefined> {
	return { kind: "ok", value };
}

export function err(): ResultError<undefined>
export function err<Error>(error: Error): ResultError<Error>
export function err<Error>(error?: Error): ResultError<Error | undefined> {
	return { kind: "error", error };
}

export function unwrap<Value, Error>(value: Result<Value, Error>): Value {
	assertResultOk(value);
	return value.value;
}

export function or<Value, Error, Default>(value: Result<Value, Error>, defaultValue: (() => Default)): Value | Default {
	if (isResultOk(value)) {
		return value.value;
	}
	return defaultValue();
}

export function isResultOk<Value>(value: unknown): value is ResultOk<unknown>
export function isResultOk<Value>(value: unknown, typeGuard: (value: unknown) => value is Value): value is ResultOk<Value>
export function isResultOk<Value>(value: unknown, typeGuard?: (value: unknown) => value is Value): value is ResultOk<Value> {
	return !!value && typeof value === "object" && "kind" in value && value.kind === "ok" && "value" in value && (!typeGuard || typeGuard(value.value));
}

export function assertResultOk<Value>(value: unknown): asserts value is ResultOk<unknown>
export function assertResultOk<Value>(value: unknown, typeGuard: (value: unknown) => value is Value): asserts value is ResultOk<Value>
export function assertResultOk<Value>(value: unknown, typeGuard?: (value: unknown) => value is Value): Value | void {
	if (!isResultOk(value, typeGuard!)) {
		throw new InvalidResultOkError();
	}
}

export function isResultError<Error>(value: unknown): value is ResultError<unknown>
export function isResultError<Error>(value: unknown, typeGuard: (value: unknown) => value is Error): value is ResultError<Error>
export function isResultError<Error>(value: unknown, typeGuard?: (value: unknown) => value is Error): value is ResultError<Error> {
	return !!value && typeof value === "object" && "kind" in value && value.kind === "error" && "error" in value && (!typeGuard || typeGuard(value.error));
}

export function assertResultError<Error>(value: unknown): asserts value is ResultError<unknown>
export function assertResultError<Error>(value: unknown, typeGuard: (value: unknown) => value is Error): asserts value is ResultError<Error>
export function assertResultError<Error>(value: unknown, typeGuard?: (value: unknown) => value is Error): asserts value is ResultError<Error> {
	if (!isResultError(value, typeGuard!)) {
		throw new InvalidResultErrorError();
	}
}

export function isResult<Value, Error>(value: unknown): value is Result<unknown, unknown>
export function isResult<Value, Error>(value: unknown, valueGuard?: (value: unknown) => value is Value): value is Result<Value, unknown>
export function isResult<Value, Error>(value: unknown, valueGuard?: (value: unknown) => value is Value, errorGuard?: (error: unknown) => error is Error): value is Result<Value, Error>
export function isResult<Value, Error>(value: unknown, valueGuard?: (value: unknown) => value is Value, errorGuard?: (error: unknown) => error is Error): value is Result<Value, Error> {
	return isResultOk(value, valueGuard!) || isResultError(value, errorGuard!);
}

export function assertResult<Value, Error>(value: unknown): asserts value is Result<unknown, unknown>
export function assertResult<Value, Error>(value: unknown, valueGuard?: (value: unknown) => value is Value): asserts value is Result<Value, unknown>
export function assertResult<Value, Error>(value: unknown, valueGuard?: (value: unknown) => value is Value, errorGuard?: (error: unknown) => error is Error): asserts value is Result<Value, Error>
export function assertResult<Value, Error>(value: unknown, valueGuard?: (value: unknown) => value is Value, errorGuard?: (error: unknown) => error is Error): asserts value is Result<Value, Error> {
	if (!isResult(value, valueGuard, errorGuard)) {
		throw new InvalidResultError();
	}
}

export class InvalidResultOkError extends Error { }
export class InvalidResultErrorError extends Error { }
export class InvalidResultError extends Error { }