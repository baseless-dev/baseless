import { createLogger } from "../../lib/logger.ts";
import type { MessageProvider } from "../message.ts";
import type { Message } from "../../lib/message/types.ts";

/**
 * A mail provider that log every message
 */
export class MemoryMessageProvider implements MessageProvider {
	#logger = createLogger("message-logger");

	messages: Message[] = [];

	// deno-lint-ignore require-await
	public async send(message: Message): Promise<void> {
		this.messages.push({ ...message });
	}
}
