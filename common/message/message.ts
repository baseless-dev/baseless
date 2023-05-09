import { InvalidMessageError } from "./errors.ts";

export interface Message<To extends string = string> {
	/**
	 * Destination of the message
	 */
	readonly recipient: To;
	/**
	 * Plain text content of the message
	 */
	readonly text: string;

	/**
	 * Subject of the message
	 */
	readonly subject?: string;

	/**
	 * HTML content of the message
	 */
	readonly html?: string;
}

export function isMessage(value?: unknown): value is Message {
	return !!value && typeof value === "object" && "to" in value &&
		typeof value.to === "string" &&
		"text" in value && typeof value.text === "string" &&
		(!("subject" in value) || typeof value.subject === "string") &&
		(!("html" in value) || typeof value.html === "string");
}

export function assertMessage(
	value: unknown,
): asserts value is Message {
	if (!isMessage(value)) {
		throw new InvalidMessageError();
	}
}
