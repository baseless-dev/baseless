import { encode, decode } from "../encoding/base32.ts";

export type OTPAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export type HOTPOptions = {
	readonly key: string | CryptoKey;
	readonly algorithm?: OTPAlgorithm;
	readonly digits?: number;
};

export type TOTPOptions = {
	readonly key: string | CryptoKey;
	readonly period: number;
	readonly algorithm?: OTPAlgorithm;
	readonly digits?: number;
};

export type OTPOptions = {
	readonly digits?: number;
};

export function isOTPAlgorithm(value?: unknown): value is OTPAlgorithm {
	return !!value && typeof value === "string" &&
		["SHA-1", "SHA-256", "SHA-384", "SHA-512"].includes(value);
}

export function assertOTPAlgorithm(
	value?: unknown,
): asserts value is OTPAlgorithm {
	if (!isOTPAlgorithm(value)) {
		throw new InvalidOTPAlgorithmError();
	}
}

export class InvalidOTPAlgorithmError extends Error {
	name = "InvalidOTPAlgorithmError" as const;
}

export function isHOTPOptions(value?: unknown): value is HOTPOptions {
	return !!value && typeof value === "object" && "key" in value &&
		(typeof value.key === "string" || value.key instanceof CryptoKey) &&
		(!("algorithm" in value) || isOTPAlgorithm(value.algorithm)) &&
		(!("digits" in value) || typeof value.digits === "number");
}

export function assertHOTPOptions(
	value?: unknown,
): asserts value is HOTPOptions {
	if (!isHOTPOptions(value)) {
		throw new InvalidHOTPOptionsError();
	}
}

export class InvalidHOTPOptionsError extends Error {
	name = "InvalidHOTPOptionsError" as const;
}

export function isTOTPOptions(value?: unknown): value is TOTPOptions {
	return !!value && typeof value === "object" && "key" in value &&
		(typeof value.key === "string" || value.key instanceof CryptoKey) &&
		"period" in value && typeof value.period === "number" &&
		(!("algorithm" in value) || isOTPAlgorithm(value.algorithm)) &&
		(!("digits" in value) || typeof value.digits === "number");
}

export function assertTOTPOptions(
	value?: unknown,
): asserts value is TOTPOptions {
	if (!isTOTPOptions(value)) {
		throw new InvalidTOTPOptionsError();
	}
}

export class InvalidTOTPOptionsError extends Error {
	name = "InvalidTOTPOptionsError" as const;
}

/**
 * Converts a counter value to a 128-bit Uint8Array representation with padding.
 * @param {number} counter - The counter value to convert.
 * @returns {Uint8Array} - A Uint8Array representing the counter value padded to 128 bits.
 */
function padCounter(counter: number) {
	const pairs = counter.toString(16).padStart(16, "0").match(/..?/g)!;
	const array = pairs.map((v) => parseInt(v, 16));
	return Uint8Array.from(array);
}

/**
 * Truncates an HMAC (Hash-based Message Authentication Code) represented as a Uint8Array.
 * @param {Uint8Array} hmac - The HMAC value to truncate.
 * @returns {number} - The truncated value extracted from the HMAC.
 */
function truncate(hmac: Uint8Array) {
	const offset = hmac[19] & 0b1111;
	return ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) |
		(hmac[offset + 2] << 8) | hmac[offset + 3];
}

/**
 * Generates a HOTP (HMAC-based One-Time Password) using the provided key, counter, and options.
 * @async
 * @param {object} params - The parameters for generating the HOTP.
 * @param {string|CryptoKey} params.key - The key to use for generating the HOTP. It can be either a string or a CryptoKey object.
 * @param {number} params.counter - The counter value to use for generating the HOTP.
 * @param {string} [params.algorithm="SHA-1"] - The algorithm to use for generating the HMAC. Defaults to "SHA-1". Allowed values are "SHA-1", "SHA-256", "SHA-384", and "SHA-512".
 * @param {number} [params.digits=6] - The number of digits to include in the generated HOTP. Defaults to 6.
 * @returns {Promise<string>} - A Promise that resolves to the generated HOTP as a string.
 * @throws {Error} - Throws an error if the provided key is not valid.
 */
export async function hotp(
	{ key, counter, algorithm = "SHA-1", digits = 6 }: HOTPOptions & {
		counter: number;
	},
) {
	assertOTPAlgorithm(algorithm);
	let cryptoKey: CryptoKey;
	if (key instanceof CryptoKey) {
		if (key.algorithm.name !== "HMAC") {
			throw new Error(`Expected \`key.name\` to be equal to "HMAC".`);
		}
		cryptoKey = key;
	} else if (typeof key === "string") {
		cryptoKey = await crypto.subtle.importKey(
			"raw",
			Uint8Array.from(decode(key)),
			{ name: "HMAC", hash: algorithm },
			false,
			["sign"],
		);
	} else {
		throw new Error(
			`Expected \`key\` to be either a string or a CryptoKey, got ${key}.`,
		);
	}
	const hmac = new Uint8Array(
		await crypto.subtle.sign("HMAC", cryptoKey, padCounter(counter)),
	);
	const num = truncate(hmac);
	return num.toString().padStart(digits, "0").slice(-digits);
}

/**
 * Generates a TOTP (Time-based One-Time Password) using the provided key, time, and options.
 * @param {object} params - The parameters for generating the TOTP.
 * @param {string|CryptoKey} params.key - The key to use for generating the TOTP. It can be either a string or a CryptoKey object.
 * @param {number} [params.time=Date.now() / 1000] - The time value to use for generating the TOTP. Defaults to the current time in seconds since epoch divided by 1000.
 * @param {number} [params.period=60] - The time period for which the TOTP is valid, in seconds. Defaults to 60 seconds.
 * @param {string} [params.algorithm] - The algorithm to use for generating the HMAC. Allowed values are "SHA-1", "SHA-256", "SHA-384", and "SHA-512".
 * @param {number} [params.digits] - The number of digits to include in the generated TOTP. If not provided, the value from the `hotp` function will be used, which defaults to 6.
 * @returns {string} - The generated TOTP as a string.
 */
export function totp(
	{ key, time = Date.now() / 1000, period = 60, algorithm, digits }:
		& TOTPOptions
		& { time: number },
) {
	return hotp({ key, counter: Math.floor(time / period), algorithm, digits });
}

/**
 * Generates a one-time password (OTP) using a random key.
 * @param {object} options - The options for generating the OTP.
 * @param {number} [options.digits=6] - The number of digits to include in the generated OTP. Defaults to 6.
 * @returns {string} - The generated OTP as a string.
 */
export function otp({ digits = 6 }: { digits?: number } = {}) {
	const hmac = new Uint8Array(digits);
	crypto.getRandomValues(hmac);
	const num = truncate(hmac);
	return num.toString().padStart(digits, "0").slice(-digits);
}

/**
 * Generates a random key for use in OTP generation.
 * @param {number} [length=16] - The length of the key to generate, in bytes. Defaults to 16.
 * @returns {string} - The generated random key encoded as a base32 string.
 */
export function generateKey(length = 16) {
	const buffer = new Uint8Array(length);
	crypto.getRandomValues(buffer);
	return encode(buffer).slice(0, length);
}

export type OTPAuthURIOptions =
	| {
		type: "hotp";
		secret: string;
		label: string;
		algorithm?: OTPAlgorithm;
		digits?: number;
		counter: number;
	}
	| {
		type: "totp";
		secret: string;
		label: string;
		algorithm?: OTPAlgorithm;
		digits?: number;
		period?: number;
	};

/**
 * Generates an OTPAuth URI based on the provided options.
 * @param {OTPAuthURIOptions} options - The options for generating the OTPAuth URI.
 * @returns {string} - The generated OTPAuth URI.
 * @throws {Error} - Throws an error if the provided options are invalid.
 */
export function toURI(options: OTPAuthURIOptions) {
	options.digits ??= 6;
	options.algorithm ??= "SHA-1";
	if (options.type === "hotp") {
		if (!("counter" in options) || typeof options.counter !== "number") {
			throw new Error(`Type "hotp" require a "counter" value.`);
		}
	} else {
		options.period ??= 30;
		if (
			"period" in options && options.period &&
			typeof options.period !== "number"
		) {
			throw new Error(`When provided, the "period" options must be a number.`);
		}
	}
	if (
		"digits" in options && options.digits && typeof options.digits !== "number"
	) {
		throw new Error(`When provided, the "digits" options must be a number.`);
	}
	if (
		"algorithm" in options && options.algorithm &&
		!isOTPAlgorithm(options.algorithm)
	) {
		throw new Error(
			`When provided, the "algorithm" options must be either "SHA-1", "SHA-256", "SHA-384" or "SHA-512".`,
		);
	}
	const { type, secret, label, ...rest } = options;
	const uri = new URL(`otpauth://${type}/${encodeURIComponent(label)}`);
	for (const [key, value] of Object.entries(rest)) {
		uri.searchParams.set(key, value.toString());
	}
	uri.searchParams.set("secret", secret);
	return uri.toString();
}
