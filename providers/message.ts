import type { Message } from "../lib/message.ts";

export interface MessageProvider {
	/**
	 * Send a message
	 * @param message The {@link Message} to be sent
	 */
	send(message: Message): Promise<void>;
}
