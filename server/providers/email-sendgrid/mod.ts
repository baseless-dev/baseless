import { EmailProvider, Message } from "../../providers/email.ts";
import { createLogger, Logger, LogLevel, LogLevelMethod } from "../../logger.ts";

export type IAddress = {
	email: string;
	name?: string;
};

/**
 * A mail provider that log every message
 */
export class SendgridEmailProvider implements EmailProvider {
	protected readonly logger = createLogger("sendgrid-email-provider");

	public constructor(
		private readonly options: {
			from: IAddress;
			apiKey: string;
			replyTo?: IAddress;
			templateId?: string;
			// deno-lint-ignore no-explicit-any
			dynamicTemplateData?: any;
		},
	) {}

	public async send(message: Message): Promise<void> {
		const content = [
			{
				type: "text/plain",
				value: message.text,
			},
		];
		if (message.html) {
			content.push({ type: "text/html", value: message.html });
		}
		const body = {
			personalizations: [{
				to: [{ email: message.to }],
				dynamicTemplateData: this.options.dynamicTemplateData,
			}],
			subject: message.subject,
			from: this.options.from,
			replyTo: this.options.replyTo,
			content,
			templateId: this.options.templateId,
		};
		await fetch("https://api.sendgrid.com/v3/mail/send", {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${this.options.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});
	}
}
