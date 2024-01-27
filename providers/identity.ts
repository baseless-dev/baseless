import type { AutoId } from "../lib/autoid.ts";
import type { Identity } from "../lib/identity.ts";

/**
 * Identity Provider
 */
export interface IdentityProvider {
	get(identityId: AutoId): Promise<Identity>;
	getByIdentification(type: string, identification: string): Promise<Identity>;
	create(
		meta: Identity["meta"],
		components: Identity["components"],
	): Promise<Identity>;
	update(
		identity: Identity,
	): Promise<void>;
	delete(identityId: AutoId): Promise<void>;
}
