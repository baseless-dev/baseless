declare const ERROR: unique symbol;

export type AutoId = string;

const AutoIdChars =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const AutoIdCharsLength = AutoIdChars.length;
const AutoIdBuffer = new Uint8Array(22);
const KSAutoIdBuffer = new Uint8Array(32);

/**
 * Generate an AutoId
 * @param prefix The prefix for the AutoId
 * @returns An AutoId
 */
export function autoid(prefix = ""): AutoId {
	let result = prefix;

	crypto.getRandomValues(AutoIdBuffer);
	for (let i = 0; i < 22; ++i) {
		result += AutoIdChars.charAt(AutoIdBuffer[i] % AutoIdCharsLength);
	}
	return result as AutoId;
}

export function ksautoid(
	prefix = "",
	time = Date.now(),
): AutoId {
	if (time > Number.MAX_SAFE_INTEGER || time < 0) {
		throw new RangeError("The time is out of range");
	}
	let result = prefix;
	new DataView(KSAutoIdBuffer.buffer).setBigInt64(0, BigInt(time), false);
	crypto.getRandomValues(KSAutoIdBuffer.subarray(8));
	for (let i = 0; i < 30; ++i) {
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

export function isAutoId(
	value?: unknown,
	prefix = "",
	length = 22,
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

export class AutoIdGenerator {
	#prefix: string;
	#length: number;
	#hash: [number, number, number, number] = [
		1779033703,
		3144134277,
		1013904242,
		2773480762,
	];

	constructor(prefix = "", length = 22) {
		this.#prefix = prefix;
		this.#length = length;
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
		const buffer = new Uint8Array(this.#length);
		for (let i = 0; i < this.#length; ++i) {
			buffer[i] = rand();
		}
		for (let i = 0; i < this.#length; ++i) {
			autoid += AutoIdChars.charAt(buffer[i] % AutoIdCharsLength);
		}
		return autoid as AutoId;
	}
}

export class AutoIdStream extends WritableStream<ArrayLike<number>> {
	#gen: AutoIdGenerator;
	public constructor(prefix = "") {
		super({
			write: (chunk) => {
				this.#gen.write(chunk);
			},
		});
		this.#gen = new AutoIdGenerator(prefix);
	}

	read(): AutoId {
		return this.#gen.read();
	}
}

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
