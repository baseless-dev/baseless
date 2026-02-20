declare const BRAND: unique symbol;

/**
 * A unique identifier with an optional prefix
 */
export type ID<Prefix extends string = ""> = string & { [BRAND]: Prefix };

const buffer1 = new Uint8Array(17);
const buffer2 = new Uint8Array(8);
const dataview = new DataView(buffer2.buffer);

/**
 * Generate a random ID.
 * @param prefix The prefix of the ID.
 * @returns A random ID.
 *
 * ```ts
 * const userID = id("usr_");   // usr_GRALowatjy5YUXZhpqqfJ2
 * const secretKey = id("sk_"); // sk_eC7a3Iv8bozeQ6QGPLlCBg
 * ```
 */
export function id(): ID;
export function id<const Prefix extends string>(prefix: Prefix): ID<Prefix>;
export function id(prefix?: string): ID {
	crypto.getRandomValues(buffer1);
	const id = (prefix ?? "") +
		base62(buffer1);
	return id as ID;
}

/**
 * Check if the ID is valid.
 * @param id The ID to check.
 * @returns Whether the ID is valid.
 *
 * ```ts
 * const isUserIDValid = isID("usr_", userId);
 * ```
 */
export function isID(id: unknown): id is ID;
export function isID<const Prefix extends string>(
	prefix: Prefix,
	id: unknown,
): id is ID<Prefix>;
export function isID(id_or_prefix: unknown | string, id?: unknown): boolean {
	const prefix = typeof id !== "undefined" ? `${id_or_prefix}` : "";
	id = typeof id !== "undefined" ? id : id_or_prefix;
	return typeof id === "string" && id.startsWith(prefix) &&
		(id.length === prefix.length + 22 || id.length === prefix.length + 32);
}

/**
 * Asserts that the ID is valid.
 * @param id The ID to check
 *
 * ```ts
 * assertID("usr_", userId); // throws if the ID is invalid
 * ```
 */
export function assertID(id: unknown): asserts id is ID;
export function assertID<const Prefix extends string>(
	prefix: Prefix,
	id: unknown,
): asserts id is ID<Prefix>;
export function assertID(id_or_prefix: unknown | string, id?: unknown): void {
	const prefix = typeof id !== "undefined" ? `${id_or_prefix}` : "";
	id = typeof id !== "undefined" ? id : id_or_prefix;
	if (!isID(prefix, id)) {
		throw new InvalidIDError(prefix, id);
	}
}

/**
 * Error thrown when an ID is invalid.
 */
export class InvalidIDError extends Error {
	/**
	 * The expected prefix of the ID.
	 */
	expectedPrefix: string;
	/**
	 * The invalid ID.
	 */
	id: unknown;
	constructor(prefix: string, id: unknown) {
		super(`Invalid ID : expected "${prefix}{string}" and got "${id}".`);
		this.expectedPrefix = prefix;
		this.id = id;
	}
}

/**
 * The KSUID epoch.
 */
export const KSUID_EPOCH = 1545753300000;

/**
 * Generate a K-sorted random ID.
 * @param prefix The prefix of the ID.
 * @param counter The counter of the ID.
 * @returns A random ID.
 *
 * ```ts
 * const eventID = ksuid("evt_"); // evt_00035qBXKZKWXBq9fxECJKqyGVbbKNgJ
 * ```
 */
export function ksuid(): ID;
export function ksuid(counter: number): ID;
export function ksuid<const Prefix extends string>(prefix: Prefix): ID<Prefix>;
export function ksuid<const Prefix extends string>(
	prefix: Prefix,
	counter: number,
): ID<Prefix>;
export function ksuid(
	counter_or_prefix?: string | number,
	counter = Date.now() - KSUID_EPOCH,
): ID {
	let prefix = "";
	if (typeof counter_or_prefix === "number") {
		prefix = "";
		counter = counter_or_prefix;
	} else if (typeof counter_or_prefix === "string") {
		prefix = counter_or_prefix;
		counter = typeof counter === "number" ? counter : Date.now() - KSUID_EPOCH;
	}
	if (counter > Number.MAX_SAFE_INTEGER || counter < 0) {
		throw new RangeError(
			`Expected counter must be between 0 and ${Number.MAX_SAFE_INTEGER}.`,
		);
	}
	dataview.setBigInt64(0, BigInt(counter), false);
	return id(prefix + base62(buffer2)) as ID;
}

/**
 * Generate a reverse K-sorted random ID.
 * @param prefix The prefix of the ID.
 * @param counter The counter of the ID.
 * @returns A random ID.
 *
 * ```ts
 * const eventID = ksuid("evt_"); // evt_000UJ6EpPTEbBqkGSXWr7IDP7XCul9CC
 * ```
 */
export function rksuid(): ID;
export function rksuid(counter: number): ID;
export function rksuid<const Prefix extends string>(prefix: Prefix): ID<Prefix>;
export function rksuid<const Prefix extends string>(
	prefix: Prefix,
	counter: number,
): ID<Prefix>;
export function rksuid(
	counter_or_prefix?: string | number,
	counter = Number.MAX_SAFE_INTEGER - Date.now(),
): ID {
	let prefix = "";
	if (typeof counter_or_prefix === "number") {
		prefix = "";
		counter = Number.MAX_SAFE_INTEGER - counter_or_prefix;
	} else if (typeof counter_or_prefix === "string") {
		prefix = counter_or_prefix;
		counter = Number.MAX_SAFE_INTEGER -
			(typeof counter === "number" ? counter : Date.now());
	}
	return ksuid(prefix, counter) as ID;
}

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
