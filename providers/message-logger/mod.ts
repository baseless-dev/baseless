import { MessageSendError } from "../../common/message/errors.ts";
import { Message } from "../../common/message/message.ts";
import {
	createLogger,
	Logger,
	LogLevel,
	LogLevelMethod,
} from "../../common/system/logger.ts";
import { ok, PromisedResult } from "../../common/system/result.ts";
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
