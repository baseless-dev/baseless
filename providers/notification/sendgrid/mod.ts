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
export class SendgridNotificationProvider implements NotificationProvider {
	#logger = createLogger("sendgrid-notification");
	#from: IAddress;
	#apiKey: string;
	#replyTo?: IAddress;
	#templateId?: string;
	#dynamicTemplateData?: Record<string, unknown>;

	transport = "email";

	public constructor(
		options: {
			from: IAddress;
			apiKey: string;
			replyTo?: IAddress;
			templateId?: string;
			// deno-lint-ignore no-explicit-any
			dynamicTemplateData?: any;
		},
	) {
		this.#from = options.from;
		this.#apiKey = options.apiKey;
		this.#replyTo = options.replyTo;
		this.#templateId = options.templateId;
		this.#dynamicTemplateData = options.dynamicTemplateData;
	}

	/**
	 * @throws {NotificationSendError}
	 */
	public async send(
		destination: unknown,
		notification: Notification,
	): Promise<void> {
		try {
			const content = Object.entries(notification.content).reduce(
				(contents, [type, content]) => {
					return [...contents, { type, value: content }];
				},
				[] as Array<{ type: string; value: string }>,
			);
			const body = {
				personalizations: [{
					to: [{ email: destination }],
					dynamicTemplateData: this.#dynamicTemplateData,
				}],
				subject: notification.subject,
				from: this.#from,
				replyTo: this.#replyTo,
				content,
				templateId: this.#templateId,
			};
			await fetch("https://api.sendgrid.com/v3/mail/send", {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.#apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			});
		} catch (inner) {
			this.#logger.error(
				`Error while sending notification, got error : ${inner}`,
			);
		}
		throw new NotificationSendError();
	}
}
