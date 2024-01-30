import { autoid } from "../../lib/autoid.ts";
import {
	IdentityCreateError,
	IdentityDeleteError,
	IdentityNotFoundError,
} from "../../lib/identity/errors.ts";
import {
	type Identity,
	IDENTITY_AUTOID_PREFIX,
} from "../../lib/identity/types.ts";
import { createLogger } from "../../lib/logger.ts";
import type { DocumentProvider } from "../document.ts";
import type { IdentityProvider } from "../identity.ts";

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
			const id = autoid(IDENTITY_AUTOID_PREFIX);
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
			for (const [compoentnId, component] of Object.entries(components)) {
				if (component.identification) {
					atomic.notExists([
						this.#prefix,
						"identifications",
						compoentnId,
						component.identification,
					]);
					atomic.set([
						this.#prefix,
						"identifications",
						compoentnId,
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
				const [compoentnId, component] of Object.entries(identity.components)
			) {
				const oldComponent = oldIdentity.components[compoentnId];
				if (oldComponent) {
					Object.assign(component, {
						...component,
						identification: oldComponent.identification,
					});
				} else if (component.identification) {
					atomic.notExists([
						this.#prefix,
						"identifications",
						compoentnId,
						component.identification,
					]);
					atomic.set([
						this.#prefix,
						"identifications",
						compoentnId,
						component.identification,
					], identity.id);
				}
			}
			// Delete old identifications
			for (
				const [compoentnId, component] of Object.entries(
					oldIdentity.components,
				)
			) {
				const newIdentification = identity.components[compoentnId];
				if (!newIdentification && component.identification) {
					atomic.delete([
						this.#prefix,
						"identifications",
						compoentnId,
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
				const [compoentnId, component] of Object.entries(identity.components)
			) {
				if (component.identification) {
					atomic.delete([
						this.#prefix,
						"identifications",
						compoentnId,
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
