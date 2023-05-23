export type AutoId = string;

const AutoIdSize = 40;
const AutoIdChars =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const AutoIdCharsLength = AutoIdChars.length;
const AutoIdRegExp = new RegExp(`^[${AutoIdChars}]{${AutoIdSize}}$`);

/**
 * Generate an AutoId
 * @param prefix The prefix for the AutoId
 * @returns An AutoId
 */
export function autoid(prefix = ""): AutoId {
	let result = prefix;
	const buffer = new Uint8Array(AutoIdSize);
	crypto.getRandomValues(buffer);
	for (let i = 0; i < AutoIdSize; ++i) {
		result += AutoIdChars.charAt(buffer[i] % AutoIdCharsLength);
	}
	return result;
}

export class AutoIdGenerator {
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

	write(chunk: ArrayLike<number>): void {
		this.#hash = cyrb128(chunk, ...this.#hash);
	}

	read(): AutoId {
		let autoid = this.#prefix;
		const buffer = new Uint8Array(AutoIdSize);
		const rand = sfc32(
			this.#hash[0],
			this.#hash[1],
			this.#hash[2],
			this.#hash[3],
		);
		for (let i = 0; i < AutoIdSize; ++i) {
			buffer[i] = rand();
		}
		for (let i = 0; i < AutoIdSize; ++i) {
			autoid += AutoIdChars.charAt(buffer[i] % AutoIdCharsLength);
		}
		return autoid;
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

export function isAutoId(value?: unknown, prefix = ""): value is AutoId {
	const pl = prefix.length;
	return !!value && typeof value === "string" &&
		value.substring(0, pl) === prefix && AutoIdRegExp.test(value.substring(pl));
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
