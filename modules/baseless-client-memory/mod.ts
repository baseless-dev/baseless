import {
	Client,
	ClientExistsError,
	ClientFoundError,
	ClientProvider,
} from "https://baseless.dev/x/baseless/provider/client.ts";
import { logger } from "https://baseless.dev/x/baseless/logger.ts";

export class ClientMemoryProvider implements ClientProvider {
	protected logger = logger("baseless-client-memory");

	protected clients = new Map<string, Client>();

	// deno-lint-ignore require-await
	async get(id: string): Promise<Client> {
		if (!this.clients.has(id)) {
			throw new ClientFoundError(id);
		}

		return this.clients.get(id)!;
	}

	// deno-lint-ignore require-await
	async add(client: Client): Promise<void> {
		if (this.clients.has(client.id)) {
			throw new ClientExistsError(client.id);
		}
		this.clients.set(client.id, client);
	}

	// deno-lint-ignore require-await
	async remove(id: string): Promise<void> {
		this.clients.delete(id);
	}
}
