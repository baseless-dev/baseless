/**
 * Message
 */
export type Message = {
	/**
	 * Destination of the message
	 */
	to: string;

	/**
	 * Subject of the message
	 */
	subject: string;

	/**
	 * Plain text content of the message
	 */
	text: string;

	/**
	 * HTML content of the message
	 */
	html?: string;
};
