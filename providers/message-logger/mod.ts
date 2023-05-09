import { MessageSendError } from "../../common/message/errors.ts";
import { Message } from "../../common/message/message.ts";
import {
	createLogger,
	Logger,
	LogLevel,
	LogLevelMethod,
} from "../../common/system/logger.ts";
import { MessageProvider } from "../message.ts";

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
