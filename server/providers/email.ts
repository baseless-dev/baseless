/**
 * Message
 */
export interface Message {
	/**
	 * Destination of the message
	 */
	readonly to: string;

	/**
	 * Subject of the message
	 */
	readonly subject: string;

	/**
	 * Plain text content of the message
	 */
	readonly text: string;

	/**
	 * HTML content of the message
	 */
	readonly html?: string;
}

export interface EmailProvider {
	/**
	 * Send a message
	 * @param message The {@link Message} to be sent
	 */
	send(message: Message): Promise<void>;
}
