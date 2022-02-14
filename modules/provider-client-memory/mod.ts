import { logger } from "https://baseless.dev/x/logger/mod.ts";
import { Client, ClientNotFoundError, IClientProvider } from "https://baseless.dev/x/provider/client.ts";

/**
 * Mail provider that send email with Sendgrid api
 */
export class MemoryClientProvider implements IClientProvider {
	private logger = logger("provider-client-memory");
	private clients = new Map<string, Client>();

	/**
	 * Construct a Sendgrid Mail Provider object with an API key
	 */
	public constructor(
		clients: Client[] = [],
	) {
		for (const client of clients) {
			this.clients.set(client.id, client);
		}
	}

	/**
	 * Retrieve a Client by it's id
	 */
	getClientById(id: string): Promise<Client> {
		if (this.clients.has(id)) {
			return Promise.resolve(this.clients.get(id)!);
		}
		return Promise.reject(new ClientNotFoundError(id));
	}
}
