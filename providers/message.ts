import type { MessageSendError } from "../common/message/errors.ts";
import type { Message } from "../common/message/message.ts";
import type { AutoId } from "../common/system/autoid.ts";
import type { Result } from "../common/system/result.ts";

export interface MessageProvider {
	/**
	 * Send a message
	 * @param message The {@link Message} to be sent
	 */
	send(message: Message<AutoId>): Promise<Result<void, MessageSendError>>;
}
