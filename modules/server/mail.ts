import { Message } from "https://baseless.dev/x/shared/deno/mail.ts";

export type MailHandler = (message: Message) => Promise<void>;

/**
 * Mail descriptor
 */
export type MailDescriptor = {
	readonly onMessageSent?: MailHandler;
};

/**
 * Mail builder
 */
export class MailBuilder {
	private onMessageSentHandler?: MailHandler;

	/**
	 * Build the auth descriptor
	 */
	public build(): MailDescriptor {
		return {
			onMessageSent: this.onMessageSentHandler,
		};
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
