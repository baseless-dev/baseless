import { Message } from "https://baseless.dev/x/shared/mail.ts";

export type MailHandler = (message: Message) => Promise<void>;

/**
 * Mail descriptor
 */
export class MailDescriptor {
	public constructor(
		private readonly onMessageSentHandler?: MailHandler,
	) {}

	public onMessageSent(message: Message): Promise<void> {
		return this.onMessageSentHandler?.(message) ?? Promise.resolve();
	}
}

/**
 * Mail builder
 */
export class MailBuilder {
	private onMessageSentHandler?: MailHandler;

	/**
	 * Build the auth descriptor
	 */
	public build(): MailDescriptor {
		return new MailDescriptor(
			this.onMessageSentHandler,
		);
	}

	/**
	 * Set the message sent handler
	 */
	public onMessageSent(handler: MailHandler) {
		this.onMessageSentHandler = handler;
		return this;
	}
}

export const mail = new MailBuilder();
