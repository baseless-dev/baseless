import { ClientExistsError, ClientInformationResponse, ClientNotFoundError, ClientProvider } from "../client.ts";
import { KeyNotFoundError, KVProvider } from "../kv.ts";
import { createLogger } from "../../logger.ts";

export class ClientKVProvider implements ClientProvider {
	protected readonly logger = createLogger("baseless-client-kv");

	public constructor(protected readonly kv: KVProvider, protected readonly prefix = "clients") {
	}

	async get(id: string): Promise<ClientInformationResponse> {
		try {
			const value = await this.kv.get(`/${this.prefix}/${id}`);
			return JSON.parse(value.value) as unknown as ClientInformationResponse;
		} catch (inner) {
			if (inner instanceof KeyNotFoundError) {
				const err = new ClientNotFoundError();
				err.cause = inner;
				throw err;
			}
			throw inner;
		}
	}

	async add(client: ClientInformationResponse): Promise<void> {
		if (await this.get(client.client_id).then(() => true).catch(() => false)) {
			throw new ClientExistsError();
		}
		await this.kv.put(`/${this.prefix}/${client.client_id}`, JSON.stringify(client));
		this.logger.debug(`Added client '${client.client_id}'.`);
	}

	async remove(id: string): Promise<void> {
		await this.kv.delete(`/${this.prefix}/${id}`);
		this.logger.debug(`Removed client '${id}'.`);
	}
}
