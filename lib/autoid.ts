declare const ERROR: unique symbol;

export type AutoId = string;

const AutoIdBuffer = new Uint8Array(15);
const Int64Buffer = new Uint8Array(8);

/**
 * Generate a Random AutoId
 * @param prefix The prefix for the AutoId
 * @returns An AutoId
 */
export function ruid(prefix = ""): AutoId {
	crypto.getRandomValues(AutoIdBuffer);
	return prefix + base62(AutoIdBuffer) as AutoId;
}

/**
 * Generate a K-Sorted AutoId
 * @param prefix The prefix for the AutoId
 * @param time The time to use for the AutoId
 * @returns An AutoId
 */
export function ksuid(
	prefix = "",
	time = Date.now() - 1708922339824,
): AutoId {
	if (time > Number.MAX_SAFE_INTEGER || time < 0) {
		throw new RangeError("The time is out of range");
	}
	new DataView(Int64Buffer.buffer).setBigInt64(0, BigInt(time), false);
	return ruid(prefix + base62(Int64Buffer));
}

/**
 * Generate a Reverse K-Sorted AutoId
 * @param prefix The prefix for the AutoId
 * @param time The time to use for the AutoId
 * @returns An AutoId
 */
export function rksuid(
	prefix = "",
	time = Date.now() - 1708922339824,
): AutoId {
	return ksuid(prefix, Number.MAX_SAFE_INTEGER - time);
}

// deno-fmt-ignore
const base62RegExp = new RegExp(`^[0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz]{20,30}$`);

export function isAutoId(
	value?: unknown,
	prefix = "",
): value is AutoId {
	const pl = prefix.length;
	return !!value && typeof value === "string" &&
		value.startsWith(prefix) &&
		base62RegExp.test(value.substring(pl));
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

/**
 * Convert buffer to base62 string using the buffer as temporary storage
 */
function base62(buffer: Uint8Array): string {
	// 1.3435902316563355 = Math.log2(256) / Math.log2(62)
	const target = Math.floor(buffer.length * 1.3435902316563355);
	let result = "";

	let length = buffer.length;
	while (length > 0 && result.length < target) {
		let pointer = 0;
		let remainder = 0;

		for (let i = 0; i < length; ++i) {
			const acc = buffer[i] + remainder * 256;
			const q = Math.floor(acc / 62);
			remainder = acc % 62;
			if (pointer > 0 || q > 0) {
				buffer[pointer++] = q;
			}
		}
		length = pointer;

		// deno-fmt-ignore
		result = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"[remainder] + result;
	}

	return result.padStart(target, "0");
}
