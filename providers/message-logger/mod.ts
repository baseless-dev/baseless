import { MessageSendError } from "../../common/message/errors.ts";
import { Message } from "../../common/message/message.ts";
import { LogLevel, LogLevelMethod, Logger, createLogger } from "../../common/system/logger.ts";
import { PromisedResult, ok } from "../../common/system/result.ts";
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
	public async send(message: Message): PromisedResult<void, never> {
		this.#logger[this.#logMethod](JSON.stringify(message));
		return ok();
	}
}
