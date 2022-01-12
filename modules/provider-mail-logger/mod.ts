import { getLogger } from "https://deno.land/std@0.118.0/log/mod.ts";
import { Message } from "https://baseless.dev/x/shared/deno/mail.ts";
import { IMailProvider } from "https://baseless.dev/x/provider/deno/mail.ts";

/**
 * Mail provider that output to console the message sent
 */
export class LoggerMailProvider implements IMailProvider {
	private logger = getLogger("baseless-mail-logger");

	/**
	 * Send a message
	 */
	// deno-lint-ignore require-await
	public async send(message: Message): Promise<void> {
		this.logger.info(JSON.stringify(message));
	}
}
