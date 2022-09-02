/**
 * Client
 */
export interface Client {
	id: string;
	principal: string;
}

/**
 * Client Provider
 */
export interface ClientProvider {
	/**
	 * Retrieve a Client by it's id
	 */
	get(id: string): Promise<Client>;

	/**
	 * Add new Client
	 */
	add(client: Client): Promise<void>;

	/**
	 * Remove a Client
	 */
	remove(id: string): Promise<void>;
}

/**
 * Client not found error
 */
export class ClientFoundError extends Error {
	public name = "ClientFoundError";
	public constructor(id: string) {
		super(`Client '${id}' not found.`);
	}
}

/**
 * Client exists error
 */
export class ClientExistsError extends Error {
	public name = "ClientExistsError";
	public constructor(id: string) {
		super(`Client '${id}' already exists.`);
	}
}
