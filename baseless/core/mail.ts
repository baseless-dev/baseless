import { NoopServiceError } from "./mod.ts";

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

/**
 * Message
 */
export type Message = {
	/**
	 * Destination of the message
	 */
	to: string;

	/**
	 * Subject of the message
	 */
	subject: string;

	/**
	 * Plain text content of the message
	 */
	text: string;

	/**
	 * HTML content of the message
	 */
	html?: string;
};

/**
 * Mail Provider
 */
export interface IMailProvider {
	/**
	 * Send a message
	 */
	send(message: Message): Promise<void>;
}

/**
 * Mail Service
 */
export interface IMailService {
	/**
	 * Send a message
	 */
	send(message: Message): Promise<void>;
}

/**
 * Mail service backed by a IMailProvider
 */
export class MailService implements IMailService {
	/**
	 * Construct a new MailService backed by an IMailProvider
	 */
	public constructor(
		protected descriptor: MailDescriptor,
		protected provider: IMailProvider,
	) {}

	/**
	 * Send a message
	 */
	public async send(message: Message): Promise<void> {
		await this.provider.send(message);
		if (this.descriptor.onMessageSent) {
			await this.descriptor.onMessageSent(message);
		}
	}
}

/**
 * Noop mail service backed by a IMailProvider
 */
export class NoopMailService implements IMailService {
	/**
	 * Send a message
	 */
	public send(): Promise<void> {
		return Promise.reject(new NoopServiceError());
	}
}
