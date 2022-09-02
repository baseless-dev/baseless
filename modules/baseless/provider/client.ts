/**
 * Client
 */
export interface Client {
	readonly id: string;
	readonly principal: string;
}

/**
 * Client Provider
 */
export interface ClientProvider {
	/**
	 * Retrieve a Client by it's id
	 *
	 * @throws {@link ClientNotFoundError} This exception is thrown if the client is not found
	 */
	get(id: string): Promise<Client>;

	/**
	 * Add new Client
	 *
	 * @throws {@link ClientExistsError} This exception is thrown if a client exists with the same {@link Client.id}
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
export class ClientNotFoundError extends Error {
	public name = "ClientNotFoundError";
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
