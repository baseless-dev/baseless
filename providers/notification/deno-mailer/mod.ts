import { createLogger } from "../../../lib/logger.ts";
import type { Notification } from "../../../lib/notification/types.ts";
import { NotificationSendError } from "../../../lib/notification/errors.ts";
import type { NotificationProvider } from "../provider.ts";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

export type IAddress = {
	email: string;
	name?: string;
};

/**
 * A mail provider that log every notification
 */
export class DenoMailerNotificationProvider implements NotificationProvider {
	#logger = createLogger("deno-mailer-notification");
	#hostname: string;
	#port: number;
	#auth?: {
		username: string;
		password: string;
	};
	#tls?: boolean;
	#from: IAddress;
	#replyTo?: IAddress;

	transport = "email";

	public constructor(
		options: {
			hostname: string;
			port: number;
			auth?: {
				username: string;
				password: string;
			};
			tls?: boolean;
			from: IAddress;
			replyTo?: IAddress;
		},
	) {
		this.#hostname = options.hostname;
		this.#port = options.port;
		this.#auth = options.auth;
		this.#tls = options.tls;
		this.#from = options.from;
		this.#replyTo = options.replyTo;
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
			const client = new SMTPClient({
				connection: {
					hostname: this.#hostname,
					port: this.#port,
					auth: this.#auth,
					tls: this.#tls,
				},
				debug: {
					allowUnsecure: this.#tls === false,
				},
				pool: false,
			});
			await client.send({
				from: this.#from.email,
				to: `${destination}`,
				replyTo: this.#replyTo?.email,
				subject: notification.subject ?? "",
				content: plainText,
				html: htmlText,
			});
			await client.close();
			return;
		} catch (inner) {
			console.log(inner);
			this.#logger.error(
				`Error while sending notification, got error : ${inner}`,
			);
		}
		throw new NotificationSendError();
	}
}
