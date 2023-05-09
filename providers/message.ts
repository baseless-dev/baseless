// deno-lint-ignore no-unused-vars
import type { MessageSendError } from "../common/message/errors.ts";
import type { Message } from "../common/message/message.ts";
import type { AutoId } from "../common/system/autoid.ts";

export interface MessageProvider {
	/**
	 * Send a message
	 * @param message The {@link Message} to be sent
	 * @throws {MessageSendError}
	 */
	send(message: Message<AutoId>): Promise<void>;
}
