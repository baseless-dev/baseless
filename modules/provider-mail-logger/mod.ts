import { logger } from "https://baseless.dev/x/logger/mod.ts";
import { Message } from "https://baseless.dev/x/shared/mail.ts";
import { IMailProvider } from "https://baseless.dev/x/provider/mail.ts";

/**
 * Mail provider that output to console the message sent
 */
export class LoggerMailProvider implements IMailProvider {
	private logger = logger("provider-mail-logger");

	/**
	 * Send a message
	 */
	// deno-lint-ignore require-await
	public async send(message: Message): Promise<void> {
		this.logger.info(JSON.stringify(message));
	}
}
