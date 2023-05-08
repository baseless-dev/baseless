import { MessageSendError } from "../../common/message/errors.ts";
import { Message } from "../../common/message/message.ts";
import { createLogger } from "../../common/system/logger.ts";
import { PromisedResult, err, ok } from "../../common/system/result.ts";
import { MessageProvider } from "../message.ts";

export type IAddress = {
	email: string;
	name?: string;
};

/**
 * A mail provider that log every message
 */
export class SendgridMessageProvider implements MessageProvider {
	#logger = createLogger("sendgrid-message-provider");
	#from: IAddress;
	#apiKey: string;
	#replyTo?: IAddress;
	#templateId?: string;
	#dynamicTemplateData?: Record<string, unknown>;

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

	public async send(message: Message): PromisedResult<void, MessageSendError> {
		try {
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
					to: [{ email: message.recipient }],
					dynamicTemplateData: this.#dynamicTemplateData,
				}],
				subject: message.subject,
				from: this.#from,
				replyTo: this.#replyTo,
				content,
				templateId: this.#templateId,
			};
			const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${this.#apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			});
			if (response.status === 202) {
				return ok();
			}
		} catch (inner) {
			this.#logger.error(`Error while sending message, got error : ${inner}`);
		}
		return err(new MessageSendError());
	}
}
