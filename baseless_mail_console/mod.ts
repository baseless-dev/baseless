import {
	IMailProvider,
	Message,
} from "https://baseless.dev/x/baseless/core/mail.ts";

/**
 * Mail provider that output to console the message sent
 */
export class MailLoggerProvider implements IMailProvider {
	/**
	 * Send a message
	 */
	public async send(message: Message): Promise<void> {
		console.log(JSON.stringify(message));
	}
}
