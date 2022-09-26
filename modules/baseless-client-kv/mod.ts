import { ClientInformationResponse, ClientExistsError, ClientNotFoundError, ClientProvider } from "https://baseless.dev/x/baseless/provider/client.ts";
import { KeyNotFoundError, KVProvider } from "https://baseless.dev/x/baseless/provider/kv.ts";
import { logger } from "https://baseless.dev/x/baseless/logger.ts";

export class ClientKVProvider implements ClientProvider {
	protected readonly logger = logger("baseless-client-kv");

	public constructor(protected readonly kv: KVProvider, protected readonly prefix = "clients") {
	}

	async get(id: string): Promise<ClientInformationResponse> {
		try {
			const value = await this.kv.get(`/${this.prefix}/${id}`);
			return JSON.parse(value.value) as unknown as ClientInformationResponse;
		} catch (inner) {
			if (inner instanceof KeyNotFoundError) {
				const err = new ClientNotFoundError(id);
				err.cause = inner;
				throw err;
			}
			throw inner;
		}
	}

	async add(client: ClientInformationResponse): Promise<void> {
		if (await this.get(client.client_id).then(() => true).catch(() => false)) {
			throw new ClientExistsError(client.client_id);
		}
		await this.kv.put(`/${this.prefix}/${client.client_id}`, JSON.stringify(client));
		this.logger.debug(`Added client '${client.client_id}'.`);
	}

	async remove(id: string): Promise<void> {
		await this.kv.delete(`/${this.prefix}/${id}`);
		this.logger.debug(`Removed client '${id}'.`);
	}
}
