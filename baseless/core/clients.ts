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
	readonly url: string;

	/**
	 * Client id
	 */
	readonly id: string;

	/**
	 * Client secret
	 */
	readonly secret: string;
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
	private clients = new Set<Client>();

	/**
	 * Build the auth descriptor
	 */
	public build(): ClientsDescriptor {
		if (this.clients.size === 0) {
			throw new NumberOfClientError(0);
		}
		return Array.from(this.clients);
	}

	public register(
		principal: string,
		url: string,
		id: string,
		secret: string,
	): this {
		this.clients.add({
			principal,
			url,
			id,
			secret,
		});
		return this;
	}
}
