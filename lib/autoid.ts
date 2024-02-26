declare const ERROR: unique symbol;

export type AutoId = string;

const AutoIdChars =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const AutoIdCharsLength = AutoIdChars.length;
const DefaultAutidLength = 20;
const AutoIdBuffer = new Uint8Array(DefaultAutidLength);
const KSAutoIdBuffer = new Uint8Array(12 + DefaultAutidLength);

/**
 * Generate an AutoId
 * @param prefix The prefix for the AutoId
 * @returns An AutoId
 */
export function autoid(prefix = ""): AutoId {
	let result = prefix;

	crypto.getRandomValues(AutoIdBuffer);
	for (let i = 0; i < DefaultAutidLength; ++i) {
		result += AutoIdChars.charAt(AutoIdBuffer[i] % AutoIdCharsLength);
	}
	return result as AutoId;
}

export function ksautoid(
	prefix = "",
	time = Date.now() - 1708922339824,
): AutoId {
	if (time > Number.MAX_SAFE_INTEGER || time < 0) {
		throw new RangeError("The time is out of range");
	}
	let result = prefix;
	new DataView(KSAutoIdBuffer.buffer).setBigInt64(0, BigInt(time), false);
	crypto.getRandomValues(KSAutoIdBuffer.subarray(8));
	for (let i = 0; i < DefaultAutidLength + 8; ++i) {
		result += AutoIdChars.charAt(KSAutoIdBuffer[i] % AutoIdCharsLength);
	}
	return result as AutoId;
}

export function krsautoid(
	prefix = "",
	time = Date.now() - 1708922339824,
): AutoId {
	return ksautoid(prefix, Number.MAX_SAFE_INTEGER - time);
}

/**
 * Generate an Variable AutoId
 * @param prefix The prefix for the AutoId
 * @param length The length of the AutoId
 * @returns An AutoId
 */
export function vautoid(prefix = "", length = DefaultAutidLength): AutoId {
	let result = prefix;

	const buffer = new Uint8Array(length);
	crypto.getRandomValues(buffer);
	for (let i = 0; i < length; ++i) {
		result += AutoIdChars.charAt(buffer[i] % AutoIdCharsLength);
	}
	return result as AutoId;
}

export function ksvautoid(
	prefix = "",
	length = DefaultAutidLength,
	time = Date.now() - 1708922339824,
): AutoId {
	let result = prefix;

	const buffer = new Uint8Array(8 + length);
	new DataView(buffer.buffer).setBigInt64(0, BigInt(time), false);
	crypto.getRandomValues(buffer.subarray(8));
	for (let i = 0; i < length + 8; ++i) {
		result += AutoIdChars.charAt(buffer[i] % AutoIdCharsLength);
	}
	return result as AutoId;
}

export function krsvautoid(
	prefix = "",
	length = DefaultAutidLength,
	time = Date.now() - 1708922339824,
): AutoId {
	return ksvautoid(prefix, length, Number.MAX_SAFE_INTEGER - time);
}

export function isAutoId(
	value?: unknown,
	prefix = "",
	length = DefaultAutidLength,
): value is AutoId {
	const pl = prefix.length;
	return !!value && typeof value === "string" &&
		value.startsWith(prefix) &&
		new RegExp(`^[${AutoIdChars}]{${length}}$`).test(value.substring(pl));
}

/**
 * Test if value is an AutoId
 * @param value The value to test
 * @param prefix The prefix for the AutoId
 * @returns If value is an AutoId
 */
export function assertAutoId(
	value?: unknown,
	prefix = "",
): asserts value is AutoId {
	if (!(isAutoId(value, prefix))) {
		throw new InvalidAutoIdError();
	}
}

export class InvalidAutoIdError extends Error {}
