import { MailProvider, Message } from "https://baseless.dev/x/baseless/provider/mail.ts";
import { Logger, logger, LogLevel, LogLevelMethod } from "https://baseless.dev/x/baseless/logger.ts";

/**
 * A mail provider that log every message
 */
export class MailLoggerProvider implements MailProvider {
	protected readonly logger = logger("baseless-mail-logger");

	protected readonly logMethod: keyof Logger;

	public constructor(logLevel = LogLevel.INFO) {
		this.logMethod = LogLevelMethod[logLevel];
	}

	// deno-lint-ignore require-await
	public async send(message: Message): Promise<void> {
		this.logger[this.logMethod](JSON.stringify(message));
	}
}
