import type { AutoId } from "../../lib/autoid.ts";
import type { Identity } from "../../lib/identity/types.ts";
import type { IdentityProvider } from "../../providers/identity/provider.ts";

export class IdentityService {
	#identityProvider: IdentityProvider;

	constructor(identityProvider: IdentityProvider) {
		this.#identityProvider = identityProvider;
	}

	get(identityId: AutoId): Promise<Identity> {
		return this.#identityProvider.get(identityId);
	}

	getByIdentification(type: string, identification: string): Promise<Identity> {
		return this.#identityProvider.getByIdentification(type, identification);
	}

	create(
		meta: Identity["meta"],
		components: Identity["components"],
	): Promise<Identity> {
		return this.#identityProvider.create(meta, components);
	}

	update(
		identity: Identity,
	): Promise<void> {
		return this.#identityProvider.update(identity);
	}

	delete(identityId: AutoId): Promise<void> {
		return this.#identityProvider.delete(identityId);
	}
}
