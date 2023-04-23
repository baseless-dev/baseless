/**
 * Message
 */
export interface Message<To = string> {
	/**
	 * Destination of the message
	 */
	readonly to: To;

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

export interface MessageProvider {
	/**
	 * Send a message
	 * @param message The {@link Message} to be sent
	 */
	send(message: Message): Promise<void>;
}
