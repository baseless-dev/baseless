import { Message } from "./mail.ts";

export type MessageTemplate = Omit<Message, "to"> & { link: string };

export type LocalizedMessageTemplate = Map<string, MessageTemplate>;

/**
 * Clients descriptor
 */
export type ClientsDescriptor = Client[];

/**
 * Client
 */
export type Client = {
	/**
	 * Principal
	 */
	readonly principal: string;

	/**
	 * Allowed urls
	 */
	readonly url: string[];

	/**
	 * Client id
	 */
	readonly id: string;

	/**
	 * Client secret
	 */
	readonly secret?: string;

	/**
	 * Client templates
	 */
	readonly templates: {
		validation: LocalizedMessageTemplate;
		passwordReset: LocalizedMessageTemplate;
	};
};

/**
 * Number of client error
 */
export class NumberOfClientError extends Error {
	public name = "NumberOfClientError";
	public constructor(nb: number) {
		super(`Requires at least 1 client, got ${nb}.`);
	}
}

/**
 * Clients builder
 */
export class ClientsBuilder {
	private clients: ClientBuilder[] = [];

	/**
	 * Build the auth descriptor
	 */
	public build(): ClientsDescriptor {
		return this.clients.map((client) => client.build());
	}

	public register(
		principal: string,
		url: string[],
		id: string,
	): ClientBuilder {
		const client = new ClientBuilder(principal, url, id);
		this.clients.push(client);
		return client;
	}
}

/**
 * Client builder
 */
export class ClientBuilder {
	private secret?: string;
	private templates: {
		validation: LocalizedMessageTemplate;
		passwordReset: LocalizedMessageTemplate;
	} = {
		validation: new Map(),
		passwordReset: new Map(),
	};

	public constructor(
		private principal: string,
		private url: string[],
		private id: string,
	) {}

	/**
	 * Build the auth descriptor
	 */
	public build(): Client {
		return {
			principal: this.principal,
			url: this.url,
			id: this.id,
			secret: this.secret,
			templates: {
				validation: new Map(this.templates.validation),
				passwordReset: new Map(this.templates.passwordReset),
			},
		};
	}

	/**
	 * Set secret
	 */
	public setSecret(secret: string) {
		this.secret = secret;
		return this;
	}

	/**
	 * Set the validation email template
	 */
	public setTemplateValidation(locale: string, message: MessageTemplate) {
		this.templates.validation.set(locale, message);
		return this;
	}

	/**
	 * Set the password reset template
	 */
	public setTemplatePasswordReset(locale: string, message: MessageTemplate) {
		this.templates.passwordReset.set(locale, message);
		return this;
	}
}
