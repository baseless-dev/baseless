import { EmailProvider, Message } from "https://baseless.dev/x/baseless/provider/email.ts";
import { Logger, logger, LogLevel, LogLevelMethod } from "https://baseless.dev/x/baseless/logger.ts";

/**
 * A mail provider that log every message
 */
export class EmailLoggerProvider implements EmailProvider {
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
