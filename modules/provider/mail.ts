import { Message } from "https://baseless.dev/x/shared/deno/mail.ts";

/**
 * Mail Provider
 */
export interface IMailProvider {
	/**
	 * Send a message
	 */
	send(message: Message): Promise<void>;
}

/**
 * Mail Service
 */
export interface IMailService {
	/**
	 * Send a message
	 */
	send(message: Message): Promise<void>;
}
