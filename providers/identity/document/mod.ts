import { ruid } from "../../../lib/autoid.ts";
import {
	IdentityCreateError,
	IdentityDeleteError,
	IdentityNotFoundError,
} from "../../../lib/identity/errors.ts";
import {
	type Identity,
	IDENTITY_AUTOID_PREFIX,
} from "../../../lib/identity/types.ts";
import { createLogger } from "../../../lib/logger.ts";
import type { DocumentProvider } from "../../document/provider.ts";
import type { IdentityProvider } from "../provider.ts";

export class DocumentIdentityProvider implements IdentityProvider {
	#logger = createLogger("identity-document");
	#document: DocumentProvider;
	#prefix: string;

	public constructor(
		document: DocumentProvider,
		prefix = "identities",
	) {
		this.#document = document;
		this.#prefix = prefix;
	}

	async get(identityId: string): Promise<Identity> {
		try {
			const { data } = await this.#document.get(
				[
					this.#prefix,
					"identities",
					identityId,
				],
				{ consistency: "strong" },
			);
			return data as Identity;
		} catch (_error) {
			throw new IdentityNotFoundError();
		}
	}

	async getByIdentification(
		type: string,
		identification: string,
	): Promise<Identity> {
		try {
			const { data: identityId } = await this.#document.get([
				this.#prefix,
				"identifications",
				type,
				identification,
			], { consistency: "strong" });
			const { data } = await this.#document.get(
				[
					this.#prefix,
					"identities",
					identityId as string,
				],
				{ consistency: "strong" },
			);
			return data as Identity;
		} catch (_error) {
			throw new IdentityNotFoundError();
		}
	}

	async create(
		meta: Identity["meta"],
		components: Identity["components"],
	): Promise<Identity> {
		try {
			const id = ruid(IDENTITY_AUTOID_PREFIX);
			const atomic = this.#document.atomic()
				.set([
					this.#prefix,
					"identities",
					id,
				], {
					id,
					meta,
					components,
				});
			for (const component of components) {
				if (component.identification) {
					atomic.notExists([
						this.#prefix,
						"identifications",
						component.id,
						component.identification,
					]);
					atomic.set([
						this.#prefix,
						"identifications",
						component.id,
						component.identification,
					], id);
				}
			}

			await atomic.commit();
			return { id, meta, components };
		} catch (_error) {
			throw new IdentityCreateError();
		}
	}

	async update(identity: Identity): Promise<void> {
		const { data, versionstamp } = await this.#document.get(
			[
				this.#prefix,
				"identities",
				identity.id,
			],
			{ consistency: "strong" },
		);
		const oldIdentity = data as Identity;
		try {
			const atomic = this.#document.atomic()
				.match(
					[this.#prefix, "identities", identity.id],
					versionstamp,
				);

			// Upsert identifications
			for (
				const component of identity.components
			) {
				const oldComponent = oldIdentity.components.find((c) =>
					c.id === component.id
				);
				if (oldComponent) {
					Object.assign(component, {
						...component,
						identification: oldComponent.identification,
					});
				} else if (component.identification) {
					atomic.notExists([
						this.#prefix,
						"identifications",
						component.id,
						component.identification,
					]);
					atomic.set([
						this.#prefix,
						"identifications",
						component.id,
						component.identification,
					], identity.id);
				}
			}
			// Delete old identifications
			for (
				const component of oldIdentity.components
			) {
				const newIdentification = identity.components.find((c) =>
					c.id === component.id
				);
				if (!newIdentification && component.identification) {
					atomic.delete([
						this.#prefix,
						"identifications",
						component.id,
						component.identification,
					]);
				}
			}

			// Update identity
			atomic.set([this.#prefix, "identities", identity.id], identity);

			await atomic.commit();
		} catch (_error) {
			throw new IdentityDeleteError();
		}
	}

	async delete(identityId: string): Promise<void> {
		const { data, versionstamp } = await this.#document.get(
			[
				this.#prefix,
				"identities",
				identityId,
			],
			{ consistency: "strong" },
		);
		const identity = data as Identity;
		try {
			const atomic = this.#document.atomic()
				.match([this.#prefix, "identities", identity.id], versionstamp)
				.delete([this.#prefix, "identities", identity.id]);
			for (
				const component of identity.components
			) {
				if (component.identification) {
					atomic.delete([
						this.#prefix,
						"identifications",
						component.id,
						component.identification,
					]);
				}
			}
			await atomic.commit();
		} catch (_error) {
			throw new IdentityDeleteError();
		}
	}
}
