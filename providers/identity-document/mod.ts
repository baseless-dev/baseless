import {
	IdentityCreateError,
	IdentityDeleteError,
	IdentityNotFoundError,
} from "../../common/identity/errors.ts";
import {
	assertIdentity,
	assertIdentityChallenges,
	assertIdentityIdentifications,
	assertIdentityMeta,
	type Identity,
	IDENTITY_AUTOID_PREFIX,
} from "../../common/identity/identity.ts";
import { type AutoId, autoid } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
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
			const { data } = await this.#document.get<Identity>(
				[
					this.#prefix,
					"identities",
					identityId,
				],
				{ consistency: "strong" },
			);
			return data;
		} catch (_error) {
			throw new IdentityNotFoundError();
		}
	}

	async getByIdentification(
		type: string,
		identification: string,
	): Promise<Identity> {
		try {
			const { data: identityId } = await this.#document.get<AutoId>([
				this.#prefix,
				"identifications",
				type,
				identification,
			], { consistency: "strong" });
			const { data } = await this.#document.get<Identity>(
				[
					this.#prefix,
					"identities",
					identityId,
				],
				{ consistency: "strong" },
			);
			return data;
		} catch (_error) {
			throw new IdentityNotFoundError();
		}
	}

	async create(
		meta: Identity["meta"],
		identifications: Identity["identifications"],
		challenges: Identity["challenges"],
	): Promise<Identity> {
		assertIdentityMeta(meta);
		assertIdentityIdentifications(identifications);
		assertIdentityChallenges(challenges);

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
					identifications,
					challenges,
				});
			for (const [type, identification] of Object.entries(identifications)) {
				atomic.notExists([
					this.#prefix,
					"identifications",
					type,
					identification.identification,
				]);
				atomic.set([
					this.#prefix,
					"identifications",
					type,
					identification.identification,
				], id);
			}

			await atomic.commit();
			return { id, meta, identifications, challenges };
		} catch (_error) {
			throw new IdentityCreateError();
		}
	}

	async update(identity: Identity): Promise<void> {
		assertIdentity(identity);
		const { data: oldIdentity, versionstamp } = await this.#document.get<
			Identity
		>(
			[
				this.#prefix,
				"identities",
				identity.id,
			],
			{ consistency: "strong" },
		);
		try {
			const atomic = this.#document.atomic()
				.match(
					[this.#prefix, "identities", identity.id],
					versionstamp,
				);

			// Upsert identifications
			for (
				const [type, identification] of Object.entries(identity.identifications)
			) {
				const oldIdentification = oldIdentity.identifications[type];
				if (oldIdentification) {
					Object.assign(identification, {
						...identification,
						identification: oldIdentification.identification,
					});
				} else {
					atomic.notExists([
						this.#prefix,
						"identifications",
						type,
						identification.identification,
					]);
					atomic.set([
						this.#prefix,
						"identifications",
						type,
						identification.identification,
					], identity.id);
				}
			}
			// Delete old identifications
			for (
				const [type, identification] of Object.entries(
					oldIdentity.identifications,
				)
			) {
				const newIdentification = identity.identifications[type];
				if (!newIdentification) {
					atomic.delete([
						this.#prefix,
						"identifications",
						type,
						identification.identification,
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
		const { data: identity, versionstamp } = await this.#document.get<
			Identity
		>(
			[
				this.#prefix,
				"identities",
				identityId,
			],
			{ consistency: "strong" },
		);
		try {
			const atomic = this.#document.atomic()
				.match([this.#prefix, "identities", identity.id], versionstamp)
				.delete([this.#prefix, "identities", identity.id]);
			for (
				const [type, identification] of Object.entries(identity.identifications)
			) {
				atomic.delete([
					this.#prefix,
					"identifications",
					type,
					identification.identification,
				]);
			}
		} catch (_error) {
			throw new IdentityDeleteError();
		}
	}
}
