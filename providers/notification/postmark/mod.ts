import { createLogger } from "../../../lib/logger.ts";
import type { Notification } from "../../../lib/notification/types.ts";
import { NotificationSendError } from "../../../lib/notification/errors.ts";
import type { NotificationProvider } from "../provider.ts";

export type IAddress = {
	email: string;
	name?: string;
};

/**
 * A mail provider that log every notification
 */
export class PostmarkNotificationProvider implements NotificationProvider {
	#logger = createLogger("postmark-notification");
	#from: IAddress;
	#replyTo?: IAddress;
	#apiKey: string;

	transport = "email";

	public constructor(
		options: {
			from: IAddress;
			replyTo?: IAddress;
			apiKey: string;
		},
	) {
		this.#from = options.from;
		this.#replyTo = options.replyTo;
		this.#apiKey = options.apiKey;
	}

	/**
	 * @throws {NotificationSendError}
	 */
	public async send(
		destination: unknown,
		notification: Notification,
	): Promise<void> {
		try {
			const plainText = notification.content["text/plain"] ?? undefined;
			const htmlText = notification.content["text/html"] ?? undefined;
			const body = {
				From: `${this.#from.name ?? ""} <${this.#from.email}>`,
				ReplyTo: this.#replyTo
					? `${this.#replyTo.name ?? ""} <${this.#replyTo.email}>`
					: undefined,
				To: `${destination}`,
				Subject: notification.subject ?? "",
				TextBody: plainText,
				HtmlBody: htmlText,
				MessageStream: "outbound",
			};
			await fetch("https://api.postmarkapp.com/email", {
				method: "POST",
				headers: {
					"Accept": "application/json",
					"Content-Type": "application/json",
					"X-Postmark-Server-Token": `${this.#apiKey}`,
				},
				body: JSON.stringify(body),
			});
			return;
		} catch (inner) {
			this.#logger.error(
				`Error while sending notification, got error : ${inner}`,
			);
		}
		throw new NotificationSendError();
	}
}
