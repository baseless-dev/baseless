declare const ERROR: unique symbol;

export type AutoId = string;

const AutoIdChars =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const AutoIdCharsLength = AutoIdChars.length;
const AutoIdBuffer = new Uint8Array(22);
const Int64Buffer = new Uint8Array(8);

/**
 * Generate a Random AutoId
 * @param prefix The prefix for the AutoId
 * @returns An AutoId
 */
export function ruid(prefix = ""): AutoId {
	let result = prefix;

	crypto.getRandomValues(AutoIdBuffer);
	for (let i = 0; i < 22; ++i) {
		result += AutoIdChars.charAt(AutoIdBuffer[i] % AutoIdCharsLength);
	}
	return result as AutoId;
}

/**
 * Generate a Seeded AutoId
 * @param seed The seed for the AutoId
 * @param prefix The prefix for the AutoId
 * @returns An AutoId
 */
export function suid(
	seed: string | Uint8Array,
	prefix = "",
): AutoId {
	gen.reset();
	gen.write(seed instanceof Uint8Array ? seed : encoder.encode(seed));
	return (prefix + gen.read()) as AutoId;
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
	let result = prefix;
	new DataView(Int64Buffer.buffer).setBigInt64(0, BigInt(time), false);
	for (let i = 0; i < 8; ++i) {
		result += AutoIdChars.charAt(Int64Buffer[i] % AutoIdCharsLength);
	}
	return ruid(result);
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

export function isAutoId(
	value?: unknown,
	prefix = "",
): value is AutoId {
	const pl = prefix.length;
	return !!value && typeof value === "string" &&
		value.startsWith(prefix) &&
		new RegExp(`^[${AutoIdChars}]{22,30}$`).test(value.substring(pl));
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

class AutoIdGenerator {
	#prefix: string;
	#hash: [number, number, number, number] = [
		1779033703,
		3144134277,
		1013904242,
		2773480762,
	];

	constructor(prefix = "") {
		this.#prefix = prefix;
	}

	reset(hash: [number, number, number, number] = [
		1779033703,
		3144134277,
		1013904242,
		2773480762,
	]): void {
		this.#hash = hash;
	}

	write(chunk: ArrayLike<number>): void {
		this.#hash = cyrb128(chunk, ...this.#hash);
	}

	read(): AutoId {
		let autoid = this.#prefix;
		const rand = sfc32(
			this.#hash[0],
			this.#hash[1],
			this.#hash[2],
			this.#hash[3],
		);
		for (let i = 0; i < 22; ++i) {
			AutoIdBuffer[i] = rand();
		}
		for (let i = 0; i < 22; ++i) {
			autoid += AutoIdChars.charAt(AutoIdBuffer[i] % AutoIdCharsLength);
		}
		return autoid as AutoId;
	}
}

// class AutoIdStream extends WritableStream<ArrayLike<number>> {
// 	#gen: AutoIdGenerator;
// 	public constructor(prefix = "") {
// 		super({
// 			write: (chunk) => {
// 				this.#gen.write(chunk);
// 			},
// 		});
// 		this.#gen = new AutoIdGenerator(prefix);
// 	}

// 	read(): AutoId {
// 		return this.#gen.read();
// 	}
// }

/**
 * Create a 128 hash of a string
 * @param str
 * @param h1
 * @param h2
 * @param h3
 * @param h4
 * @returns An array of 4 32bit integer
 */
function cyrb128(
	buffer: ArrayLike<number>,
	h1 = 1779033703,
	h2 = 3144134277,
	h3 = 1013904242,
	h4 = 2773480762,
): [number, number, number, number] {
	for (let i = 0, j = buffer.length, k; i < j; i++) {
		k = buffer[i];
		h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
		h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
		h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
		h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
	return [
		(h1 ^ h2 ^ h3 ^ h4) >>> 0,
		(h2 ^ h1) >>> 0,
		(h3 ^ h1) >>> 0,
		(h4 ^ h1) >>> 0,
	];
}

/**
 * Simple Fast Counter 32
 * @param a
 * @param b
 * @param c
 * @param d
 * @returns
 */
function sfc32(a: number, b: number, c: number, d: number): () => number {
	return function (): number {
		a >>>= 0;
		b >>>= 0;
		c >>>= 0;
		d >>>= 0;
		let t = (a + b) | 0;
		a = b ^ b >>> 9;
		b = c + (c << 3) | 0;
		c = c << 21 | c >>> 11;
		d = d + 1 | 0;
		t = t + d | 0;
		c = c + t | 0;
		return (t >>> 0);
	};
}

const encoder = new TextEncoder();
const gen = new AutoIdGenerator();
