import { EmailProvider, Message } from "../../providers/email.ts";
import {
	createLogger,
	Logger,
	LogLevel,
	LogLevelMethod,
} from "../../logger.ts";

/**
 * A mail provider that log every message
 */
export class LoggerEmailProvider implements EmailProvider {
	protected readonly logger = createLogger("baseless-mail-logger");

	protected readonly logMethod: keyof Logger;

	public constructor(logLevel = LogLevel.INFO) {
		this.logMethod = LogLevelMethod[logLevel];
	}

	// deno-lint-ignore require-await
	public async send(message: Message): Promise<void> {
		this.logger[this.logMethod](JSON.stringify(message));
	}
}
