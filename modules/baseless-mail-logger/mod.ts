import { MailProvider, Message } from "https://baseless.dev/x/baseless/provider/mail.ts";
import { logger } from "https://baseless.dev/x/baseless/logger.ts";

export class MailLoggerProvider implements MailProvider {
	protected logger = logger("baseless-mail-logger");

	// deno-lint-ignore require-await
	public async send(message: Message): Promise<void> {
		this.logger.info(JSON.stringify(message));
	}
}
