import { Message, MessageProvider } from "../../server/providers/message.ts";
import {
	createLogger,
	Logger,
	LogLevel,
	LogLevelMethod,
} from "../../server/logger.ts";

/**
 * A mail provider that log every message
 */
export class LoggerMessageProvider implements MessageProvider {
	#logger = createLogger("message-logger");

	#logMethod: keyof Logger;

	public constructor(logLevel = LogLevel.INFO) {
		this.#logMethod = LogLevelMethod[logLevel];
	}

	// deno-lint-ignore require-await
	public async send(message: Message): Promise<void> {
		this.#logger[this.#logMethod](JSON.stringify(message));
	}
}
