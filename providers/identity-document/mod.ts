import {
	IdentityChallengeDeleteError,
	IdentityDeleteError,
	IdentityIdentificationCreateError,
	IdentityIdentificationDeleteError,
	IdentityIdentificationNotFoundError,
	IdentityIdentificationUpdateError,
} from "../../client/errors.ts";
import { DocumentKey } from "../../common/document/document.ts";
import { IdentityChallenge } from "../../common/identity/challenge.ts";
import { IdentityIdentification } from "../../common/identity/identification.ts";
import {
	Identity,
	IDENTITY_AUTOID_PREFIX,
} from "../../common/identity/identity.ts";
import { AutoId, autoid } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { DocumentProvider } from "../document.ts";
import { IdentityProvider } from "../identity.ts";

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
		const { data: identity } = await this.#document.get<Identity>([
			this.#prefix,
			"identities",
			identityId,
		]);
		return identity;
	}

	async create(
		meta: Record<string, unknown>,
	): Promise<Identity> {
		const identity: Identity = {
			id: autoid(IDENTITY_AUTOID_PREFIX),
			meta,
		};
		await this.#document.create<Identity>(
			[this.#prefix, "identities", identity.id],
			identity,
		);
		return identity;
	}

	async update(
		identity: Identity,
	): Promise<void> {
		await this.#document.update<Identity>(
			[this.#prefix, "identities", identity.id],
			identity,
		);
	}

	async delete(identityId: AutoId): Promise<void> {
		const document = await this.#document.get<Identity>(
			[this.#prefix, "identities", identityId],
		);
		const listResult = await this.#document.list({
			prefix: [this.#prefix, "identities", identityId],
		});
		const identificationKeys: DocumentKey[] = [];
		let atomic = this.#document.atomic()
			.match(document.key, document.versionstamp)
			.delete(document.key);
		for (const key of listResult.keys) {
			atomic = atomic.delete(key);
			if (key.at(3) === "identifications" && key.length === 4) {
				identificationKeys.push([
					this.#prefix,
					"identities",
					identityId,
					"identifications",
					key.at(4)!,
				]);
			}
		}
		const identifications = await this.#document.getMany<
			IdentityIdentification
		>(identificationKeys);
		for (const identification of identifications) {
			atomic = atomic.delete([
				this.#prefix,
				"identifications",
				identification.data.type,
				identification.data.identification,
			]);
		}
		const commitResult = await this.#document.commit(atomic);
		if (!commitResult.ok) {
			throw new IdentityDeleteError();
		}
	}

	async listIdentification(identityId: AutoId): Promise<string[]> {
		const identifications = await this.#document.list({
			prefix: [this.#prefix, "identities", identityId, "identifications"],
		});
		return identifications.keys.map((key) => key.at(-1)!);
	}

	async matchIdentification(
		type: string,
		identification: string,
	): Promise<IdentityIdentification> {
		try {
			const result = await this.#document.get<IdentityIdentification>(
				[this.#prefix, "identifications", type, identification],
			);
			return result.data;
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
		const result = await this.#document.get<IdentityIdentification>(
			[this.#prefix, "identities", identityId, "identifications", type],
		);
		return result.data;
	}

	async createIdentification(
		identityIdentification: IdentityIdentification,
	): Promise<void> {
		const atomic = this.#document.atomic()
			.notExists([
				this.#prefix,
				"identifications",
				identityIdentification.type,
				identityIdentification.identification,
			])
			.set(
				[
					this.#prefix,
					"identifications",
					identityIdentification.type,
					identityIdentification.identification,
				],
				identityIdentification,
			)
			.set([
				this.#prefix,
				"identities",
				identityIdentification.identityId,
				"identifications",
				identityIdentification.type,
			], identityIdentification);
		const result = await this.#document.commit(atomic);
		if (!result.ok) {
			throw new IdentityIdentificationCreateError();
		}
	}

	async updateIdentification(
		identityIdentification: IdentityIdentification,
	): Promise<void> {
		const document = await this.#document.get<IdentityIdentification>([
			this.#prefix,
			"identities",
			identityIdentification.identityId,
			"identifications",
			identityIdentification.type,
		]);
		const updatedIdentityIdentification: IdentityIdentification = {
			...document.data,
			...identityIdentification,
		};
		const atomic = this.#document.atomic()
			.match(document.key, document.versionstamp)
			.set(document.key, updatedIdentityIdentification)
			.set([
				this.#prefix,
				"identifications",
				document.data.type,
				document.data.identification,
			], updatedIdentityIdentification);
		const commitResult = await this.#document.commit(atomic);
		if (!commitResult.ok) {
			throw new IdentityIdentificationUpdateError();
		}
	}

	async deleteIdentification(identityId: AutoId, type: string): Promise<void> {
		const document = await this.#document.get<IdentityIdentification>([
			this.#prefix,
			"identities",
			identityId,
			"identifications",
			type,
		]);
		const atomic = this.#document.atomic()
			.match(document.key, document.versionstamp)
			.delete(document.key)
			.delete([
				this.#prefix,
				"identifications",
				document.data.type,
				document.data.identification,
			]);
		const commitResult = await this.#document.commit(atomic);
		if (!commitResult.ok) {
			throw new IdentityIdentificationDeleteError();
		}
	}

	async listChallenge(identityId: AutoId): Promise<string[]> {
		const result = await this.#document.list({
			prefix: [this.#prefix, "identities", identityId, "challenges"],
		});
		return result.keys.map((key) => key.at(-1)!);
	}

	async getChallenge(
		identityId: AutoId,
		type: string,
	): Promise<IdentityChallenge> {
		const result = await this.#document.get<IdentityChallenge>(
			[this.#prefix, "identities", identityId, "challenges", type],
		);
		return result.data;
	}

	async createChallenge(
		identityChallenge: IdentityChallenge,
	): Promise<void> {
		await this.#document.create<IdentityChallenge>(
			[
				this.#prefix,
				"identities",
				identityChallenge.identityId,
				"challenges",
				identityChallenge.type,
			],
			identityChallenge,
		);
	}

	async updateChallenge(
		identityChallenge: IdentityChallenge,
	): Promise<void> {
		await this.#document.update<IdentityChallenge>(
			[
				this.#prefix,
				"identities",
				identityChallenge.identityId,
				"challenges",
				identityChallenge.type,
			],
			identityChallenge,
		);
	}

	async deleteChallenge(identityId: AutoId, type: string): Promise<void> {
		try {
			const document = await this.#document.get<IdentityChallenge>(
				[this.#prefix, "identities", identityId, "challenges", type],
			);
			const atomic = this.#document.atomic()
				.match(document.key, document.versionstamp)
				.delete(document.key);
			const result = await this.#document.commit(atomic);
			if (!result.ok) {
				throw new IdentityChallengeDeleteError();
			}
		} catch (_) {
			throw new IdentityChallengeDeleteError();
		}
	}
}
