import { getLogger } from "https://deno.land/std@0.118.0/log/mod.ts";
import {
	IMailProvider,
	Message,
} from "https://baseless.dev/x/baseless/core/mail.ts";

export type IAddress = {
	email: string;
	name?: string;
};

/**
 * Mail provider that send email with Sendgrid api
 */
export class SendgridMailProvider implements IMailProvider {
	private logger = getLogger("baseless_mail_sendgrid");

	/**
	 * Construct a Sendgrid Mail Provider object with an API key
	 */
	public constructor(
		private options: {
			from: IAddress;
			apiKey: string;
			replyTo?: IAddress;
			templateId?: string;
			// deno-lint-ignore no-explicit-any
			dynamicTemplateData?: any;
		},
	) {}

	/**
	 * Send a message
	 */
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
