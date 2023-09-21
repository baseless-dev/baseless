import {
	IdentityChallengeExistsError,
	IdentityChallengeNotFoundError,
	IdentityIdentificationCreateError,
	IdentityIdentificationDeleteError,
	IdentityIdentificationNotFoundError,
	IdentityUpdateError,
} from "../../client/errors.ts";
import type { DocumentKey } from "../../common/document/document.ts";
import type { IdentityChallenge } from "../../common/identity/challenge.ts";
import type { IdentityIdentification } from "../../common/identity/identification.ts";
import {
	type Identity,
	IDENTITY_AUTOID_PREFIX,
} from "../../common/identity/identity.ts";
import { type AutoId, autoid } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { DocumentProvider } from "../document.ts";
import { type IdentityProvider } from "../identity.ts";

interface IdentityDocument {
	id: AutoId;
	meta: Record<string, unknown>;
	identifications: Record<
		IdentityIdentification["type"],
		IdentityIdentification
	>;
	challenges: Record<IdentityChallenge["type"], IdentityChallenge>;
}

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

	async get(identityId: AutoId): Promise<Identity> {
		const { data: { id, meta } } = await this.#document.get<IdentityDocument>([
			this.#prefix,
			"identities",
			identityId,
		], { consistency: "strong" });
		return { id, meta };
	}

	async create(
		meta: Record<string, unknown>,
	): Promise<Identity> {
		const document: IdentityDocument = {
			id: autoid(IDENTITY_AUTOID_PREFIX),
			meta,
			identifications: {},
			challenges: {},
		};
		await this.#document.create<Identity>(
			[this.#prefix, "identities", document.id],
			document,
		);
		return { id: document.id, meta: document.meta };
	}

	async update(
		identity: Identity,
	): Promise<void> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identity.id],
			{ consistency: "strong" },
		);
		const result = await this.#document.atomic()
			.match(document.key, document.versionstamp)
			.set(document.key, { ...document.data, meta: identity.meta })
			.commit();
		if (!result.ok) {
			throw new IdentityUpdateError();
		}
	}

	async delete(identityId: AutoId): Promise<void> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identityId],
			{ consistency: "strong" },
		);
		const atomic = this.#document.atomic()
			.match(document.key, document.versionstamp)
			.delete(document.key);
		for (const identification of Object.values(document.data.identifications)) {
			atomic.delete([
				this.#prefix,
				"identifications",
				identification.type,
				identification.identification,
			]);
		}
		const result = await atomic.commit();
		if (!result.ok) {
			throw new IdentityUpdateError();
		}
	}

	async listIdentification(identityId: AutoId): Promise<string[]> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identityId],
			{ consistency: "strong" },
		);
		return Object.keys(document.data.identifications);
	}

	async matchIdentification(
		type: string,
		identification: string,
	): Promise<IdentityIdentification> {
		try {
			const result = await this.#document.get<DocumentKey>(
				[this.#prefix, "identifications", type, identification],
				{ consistency: "strong" },
			);
			const document = await this.#document.get<IdentityDocument>(result.data, {
				consistency: "strong",
			});
			if (type in document.data.identifications) {
				return document.data.identifications[type];
			}
		} catch (inner) {
			this.#logger.error(
				`Failed to match identification ${type}:${identification}, got ${inner}`,
			);
		}
		throw new IdentityIdentificationNotFoundError();
	}

	async getIdentification(
		identityId: string,
		type: string,
	): Promise<IdentityIdentification> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identityId],
			{ consistency: "strong" },
		);
		if (type in document.data.identifications) {
			return document.data.identifications[type];
		}
		throw new IdentityIdentificationNotFoundError();
	}

	async createIdentification(
		identityIdentification: IdentityIdentification,
	): Promise<void> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identityIdentification.identityId],
			{ consistency: "strong" },
		);
		const result = await this.#document.atomic()
			.match(document.key, document.versionstamp)
			.notExists([
				this.#prefix,
				"identifications",
				identityIdentification.type,
				identityIdentification.identification,
			])
			.set(document.key, {
				...document.data,
				identifications: {
					...document.data.identifications,
					...{ [identityIdentification.type]: identityIdentification },
				},
			})
			.set([
				this.#prefix,
				"identifications",
				identityIdentification.type,
				identityIdentification.identification,
			], document.key)
			.commit();
		if (!result.ok) {
			throw new IdentityIdentificationCreateError();
		}
	}

	async updateIdentification(
		identityIdentification: IdentityIdentification,
	): Promise<void> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identityIdentification.identityId],
			{ consistency: "strong" },
		);
		const atomic = this.#document.atomic()
			.match(document.key, document.versionstamp)
			.set(document.key, {
				...document.data,
				identifications: {
					...document.data.identifications,
					...{ [identityIdentification.type]: identityIdentification },
				},
			});
		const oldIdentityIdentification =
			document.data.identifications[identityIdentification.type];
		if (
			identityIdentification.identification !==
				oldIdentityIdentification.identification
		) {
			atomic
				.notExists([
					this.#prefix,
					"identifications",
					identityIdentification.type,
					identityIdentification.identification,
				])
				.set([
					this.#prefix,
					"identifications",
					identityIdentification.type,
					identityIdentification.identification,
				], document.key)
				.delete([
					this.#prefix,
					"identifications",
					oldIdentityIdentification.type,
					oldIdentityIdentification.identification,
				]);
		}
		const result = await atomic.commit();
		if (!result.ok) {
			throw new IdentityIdentificationCreateError();
		}
	}

	async deleteIdentification(identityId: AutoId, type: string): Promise<void> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identityId],
			{ consistency: "strong" },
		);
		const oldIdentityIdentification = document.data.identifications[type];
		const identifications = { ...document.data.identifications };
		delete identifications[type];
		const commitResult = await this.#document.atomic()
			.match(document.key, document.versionstamp)
			.set(document.key, {
				...document.data,
				identifications,
			})
			.delete([
				this.#prefix,
				"identifications",
				oldIdentityIdentification.type,
				oldIdentityIdentification.identification,
			])
			.commit();
		if (!commitResult.ok) {
			throw new IdentityIdentificationDeleteError();
		}
	}

	async listChallenge(identityId: AutoId): Promise<string[]> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identityId],
			{ consistency: "strong" },
		);
		return Object.keys(document.data.challenges);
	}

	async getChallenge(
		identityId: AutoId,
		type: string,
	): Promise<IdentityChallenge> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identityId],
			{ consistency: "strong" },
		);
		if (type in document.data.challenges) {
			return document.data.challenges[type];
		}
		throw new IdentityChallengeNotFoundError();
	}

	async createChallenge(
		identityChallenge: IdentityChallenge,
	): Promise<void> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identityChallenge.identityId],
			{ consistency: "strong" },
		);
		if (identityChallenge.type in document.data.challenges) {
			throw new IdentityChallengeExistsError();
		}
		const result = await this.#document.atomic()
			.match(document.key, document.versionstamp)
			.set(document.key, {
				...document.data,
				challenges: {
					...document.data.challenges,
					...{ [identityChallenge.type]: identityChallenge },
				},
			})
			.commit();
		if (!result.ok) {
			throw new IdentityIdentificationCreateError();
		}
	}

	async updateChallenge(
		identityChallenge: IdentityChallenge,
	): Promise<void> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identityChallenge.identityId],
			{ consistency: "strong" },
		);
		const result = await this.#document.atomic()
			.match(document.key, document.versionstamp)
			.set(document.key, {
				...document.data,
				challenges: {
					...document.data.challenges,
					...{ [identityChallenge.type]: identityChallenge },
				},
			})
			.commit();
		if (!result.ok) {
			throw new IdentityIdentificationCreateError();
		}
	}

	async deleteChallenge(identityId: AutoId, type: string): Promise<void> {
		const document = await this.#document.get<IdentityDocument>(
			[this.#prefix, "identities", identityId],
			{ consistency: "strong" },
		);
		if (!(type in document.data.challenges)) {
			throw new IdentityChallengeNotFoundError();
		}
		const challenges = { ...document.data.challenges };
		delete challenges[type];
		const result = await this.#document.atomic()
			.match(document.key, document.versionstamp)
			.set(document.key, {
				...document.data,
				challenges: challenges,
			})
			.commit();
		if (!result.ok) {
			throw new IdentityIdentificationCreateError();
		}
	}
}
