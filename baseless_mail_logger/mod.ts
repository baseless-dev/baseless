import { getLogger } from "https://deno.land/std@0.118.0/log/mod.ts";
import {
	IMailProvider,
	Message,
} from "https://baseless.dev/x/baseless/core/mail.ts";

/**
 * Mail provider that output to console the message sent
 */
export class MailLoggerProvider implements IMailProvider {
	private logger = getLogger("baseless_mail_logger");

	/**
	 * Send a message
	 */
	// deno-lint-ignore require-await
	public async send(message: Message): Promise<void> {
		this.logger.info(JSON.stringify(message));
	}
}
