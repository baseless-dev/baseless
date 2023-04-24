export interface MessageData {
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

/**
 * Message
 */
export interface Message<To = string> extends MessageData {
	/**
	 * Destination of the message
	 */
	readonly to: To;
}

export function isMessageData(value?: unknown): value is MessageData {
	return !!value && typeof value === "object" && "text" in value &&
		typeof value.text === "string" &&
		(!("subject" in value) || typeof value.subject === "string") &&
		(!("html" in value) || typeof value.html === "string");
}

export function assertMessageData(
	value: unknown,
): asserts value is MessageData {
	if (!isMessageData(value)) {
		throw new InvalidMessageDataError();
	}
}

export function isMessage(value?: unknown): value is Message {
	return isMessageData(value) && "to" in value && typeof value.to === "string";
}

export function assertMessage(value: unknown): asserts value is Message {
	if (!isMessage(value)) {
		throw new InvalidMessageError();
	}
}

export interface MessageProvider {
	/**
	 * Send a message
	 * @param message The {@link Message} to be sent
	 */
	send(message: Message): Promise<void>;
}

export class InvalidMessageDataError extends Error {}
export class InvalidMessageError extends Error {}
