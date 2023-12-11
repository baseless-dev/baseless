import type { Identity } from "../common/identity/identity.ts";
import type { AutoId } from "../common/system/autoid.ts";

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
