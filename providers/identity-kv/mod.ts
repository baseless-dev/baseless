import {
	assertIdentityChallenge,
	type IdentityChallenge,
} from "../../common/identity/challenge.ts";
import {
	IdentityChallengeCreateError,
	IdentityChallengeDeleteError,
	IdentityChallengeExistsError,
	IdentityChallengeNotFoundError,
	IdentityChallengeUpdateError,
	IdentityCreateError,
	IdentityDeleteError,
	IdentityExistsError,
	IdentityIdentificationCreateError,
	IdentityIdentificationDeleteError,
	IdentityIdentificationExistsError,
	IdentityIdentificationNotFoundError,
	IdentityIdentificationUpdateError,
	IdentityNotFoundError,
	IdentityUpdateError,
} from "../../common/identity/errors.ts";
import {
	assertIdentityIdentification,
	type IdentityIdentification,
} from "../../common/identity/identification.ts";
import {
	assertIdentity,
	type Identity,
	IDENTITY_AUTOID_PREFIX,
} from "../../common/identity/identity.ts";
import {
	assertAutoId,
	type AutoId,
	autoid,
} from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import type { IdentityProvider } from "../identity.ts";
import type { KVProvider } from "../kv.ts";

export class KVIdentityProvider implements IdentityProvider {
	#logger = createLogger("baseless-identity-kv");

	public constructor(
		protected readonly kv: KVProvider,
		protected readonly prefix = "identities",
	) {
	}

	/**
	 * @throws {IdentityNotFoundError}
	 */
	async get<Meta extends Record<string, unknown> = Record<string, unknown>>(
		id: AutoId,
	): Promise<Identity<Partial<Meta>>> {
		assertAutoId(id, IDENTITY_AUTOID_PREFIX);
		try {
			const value = await this.kv.get(`${this.prefix}/identities/${id}`);
			const identity = JSON.parse(value.value) as unknown;
			assertIdentity(identity);
			return identity as Identity<Meta>;
		} catch (inner) {
			this.#logger.error(`Failed to get identity ${id}, got ${inner}`);
		}
		throw new IdentityNotFoundError();
	}

	/**
	 * @throws {IdentityCreateError}
	 */
	async create<Meta extends Record<string, unknown> = Record<string, unknown>>(
		meta: Meta,
		expiration?: number | Date,
	): Promise<Identity> {
		try {
			const id = autoid(IDENTITY_AUTOID_PREFIX);
			const identity: Identity = { id, meta };
			await this.kv.put(
				`${this.prefix}/identities/${id}`,
				JSON.stringify(identity),
				{ expiration },
			);
			return identity as Identity<Meta>;
		} catch (inner) {
			this.#logger.error(`Failed to create identity, got ${inner}`);
		}
		throw new IdentityCreateError();
	}

	/**
	 * @throws {IdentityUpdateError}
	 */
	async update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): Promise<void> {
		try {
			const exists = await this.get(identity.id).catch((_) => undefined);
			if (!exists) {
				throw new IdentityExistsError();
			}
			await this.kv.put(
				`${this.prefix}/identities/${identity.id}`,
				JSON.stringify(identity),
				{ expiration },
			);
			return;
		} catch (inner) {
			this.#logger.error(`Failed to update identity, got ${inner}`);
		}
		throw new IdentityUpdateError();
	}

	/**
	 * @throws {IdentityDeleteError}
	 */
	async delete(id: AutoId): Promise<void> {
		try {
			assertAutoId(id, IDENTITY_AUTOID_PREFIX);
			const exists = await this.get(id).catch((_) => undefined);
			if (!exists) {
				throw new IdentityExistsError();
			}
			try {
				const ops: Promise<unknown>[] = [
					this.kv.delete(`${this.prefix}/identities/${id}`),
				];
				for (
					const { type, identification } of await this.listIdentification(id)
				) {
					ops.push(this.deleteIdentification(id, type, identification));
				}
				for (const { type } of await this.listChallenge(id)) {
					ops.push(this.deleteChallenge(id, type));
				}
				await Promise.all(ops);
				return;
			} catch (inner) {
				this.#logger.error(inner);
				throw inner;
			}
		} catch (inner) {
			this.#logger.error(`Failed to delete identity ${id}, got ${inner}`);
		}
		throw new IdentityDeleteError();
	}

	async listIdentification(
		id: AutoId,
	): Promise<IdentityIdentification[]> {
		try {
			assertAutoId(id, IDENTITY_AUTOID_PREFIX);
			const result = await this.kv.list({
				prefix: `${this.prefix}/identities/${id}/identifications/`,
			});
			return result.keys.map((key) => {
				const data = JSON.parse(key.value);
				assertIdentityIdentification(data);
				return data;
			});
		} catch (inner) {
			this.#logger.error(
				`Failed to list identifications for identity ${id}, got ${inner}`,
			);
		}
		return [];
	}

	/**
	 * @throws {IdentityIdentificationNotFoundError}
	 */
	async getIdentification<Meta extends Record<string, unknown>>(
		identityId: AutoId,
		type: string,
	): Promise<IdentityIdentification<Meta>> {
		try {
			const result = await this.kv.get(
				`${this.prefix}/identities/${identityId}/identifications/${type}`,
			);
			const data = JSON.parse(result.value);
			assertIdentityIdentification(data);
			return data as IdentityIdentification<Meta>;
		} catch (inner) {
			this.#logger.error(
				`Failed to match identification ${type}, got ${inner}`,
			);
		}
		throw new IdentityIdentificationNotFoundError();
	}

	/**
	 * @throws {IdentityIdentificationNotFoundError}
	 */
	async matchIdentification<
		Meta extends Record<string, unknown> = Record<string, unknown>,
	>(
		type: string,
		identification: string,
	): Promise<IdentityIdentification<Meta>> {
		try {
			const result = await this.kv.get(
				`${this.prefix}/identifications/${type}:${identification}`,
			);
			const data = JSON.parse(result.value);
			assertIdentityIdentification(data);
			return data as IdentityIdentification<Meta>;
		} catch (inner) {
			this.#logger.error(
				`Failed to match identification ${type}:${identification}, got ${inner}`,
			);
		}
		throw new IdentityIdentificationNotFoundError();
	}

	/**
	 * @throws {IdentityIdentificationCreateError}
	 */
	async createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void> {
		try {
			const keyIdentity =
				`${this.prefix}/identities/${identityIdentification.identityId}/identifications/${identityIdentification.type}`;
			const keyIdentification =
				`${this.prefix}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
			const exists = await this.kv.get(keyIdentification).catch((_) =>
				undefined
			);
			if (exists) {
				throw new IdentityIdentificationExistsError();
			}
			await Promise.all([
				this.kv.put(keyIdentity, JSON.stringify(identityIdentification), {
					expiration,
				}),
				this.kv.put(keyIdentification, JSON.stringify(identityIdentification), {
					expiration,
				}),
			]);
			return;
		} catch (inner) {
			this.#logger.error(
				`Failed to create identification ${identityIdentification.type}:${identityIdentification.identification}, got ${inner}`,
			);
		}
		throw new IdentityIdentificationCreateError();
	}

	/**
	 * @throws {IdentityIdentificationUpdateError}
	 */
	async updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void> {
		try {
			const keyIdentity =
				`${this.prefix}/identities/${identityIdentification.identityId}/identifications/${identityIdentification.type}`;
			const keyIdentification =
				`${this.prefix}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
			const exists = await this.kv.get(keyIdentification).catch((_) =>
				undefined
			);
			if (!exists) {
				throw new IdentityIdentificationNotFoundError();
			}
			await Promise.all([
				this.kv.put(keyIdentity, JSON.stringify(identityIdentification), {
					expiration,
				}),
				this.kv.put(keyIdentification, JSON.stringify(identityIdentification), {
					expiration,
				}),
			]);
			return;
		} catch (inner) {
			this.#logger.error(
				`Failed to update identification ${identityIdentification.type}:${identityIdentification.identification}, got ${inner}`,
			);
		}
		throw new IdentityIdentificationUpdateError();
	}

	/**
	 * @throws {IdentityIdentificationDeleteError}
	 */
	async deleteIdentification(
		id: AutoId,
		type: string,
		identification: string,
	): Promise<void> {
		try {
			assertAutoId(id, IDENTITY_AUTOID_PREFIX);
			const keyIdentity =
				`${this.prefix}/identities/${id}/identifications/${type}`;
			const keyIdentification =
				`${this.prefix}/identifications/${type}:${identification}`;
			const exists = await this.kv.get(keyIdentification).catch((_) =>
				undefined
			);
			if (!exists) {
				throw new IdentityIdentificationNotFoundError();
			}
			await Promise.all([
				this.kv.delete(keyIdentity),
				this.kv.delete(keyIdentification),
			]);
			return;
		} catch (inner) {
			this.#logger.error(
				`Failed to delete identification ${type}:${identification}, got ${inner}`,
			);
		}
		throw new IdentityIdentificationDeleteError();
	}

	async listChallenge(id: AutoId): Promise<IdentityChallenge[]> {
		try {
			assertAutoId(id, IDENTITY_AUTOID_PREFIX);
			const result = await this.kv.list({
				prefix: `${this.prefix}/identities/${id}/challenges/`,
			});
			return result.keys.map((key) => {
				const data = JSON.parse(key.value);
				assertIdentityChallenge(data);
				return data;
			});
		} catch (inner) {
			this.#logger.error(
				`Failed to list challenges for identity ${id}, got ${inner}`,
			);
		}
		return [];
	}

	/**
	 * @throws {IdentityChallengeNotFoundError}
	 */
	async getChallenge<Meta extends Record<string, unknown>>(
		id: AutoId,
		type: string,
	): Promise<IdentityChallenge<Meta>> {
		try {
			assertAutoId(id, IDENTITY_AUTOID_PREFIX);
			const result = await this.kv.get(
				`${this.prefix}/identities/${id}/challenges/${type}`,
			);
			const data = JSON.parse(result.value);
			assertIdentityChallenge(data);
			return data as IdentityChallenge<Meta>;
		} catch (inner) {
			this.#logger.error(
				`Failed to get challenge ${type} for identity ${id}, got ${inner}`,
			);
		}
		throw new IdentityChallengeNotFoundError();
	}

	/**
	 * @throws {IdentityChallengeCreateError}
	 */
	async createChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void> {
		try {
			const key =
				`${this.prefix}/identities/${identityChallenge.identityId}/challenges/${identityChallenge.type}`;
			const exists = await this.kv.get(key).catch((_) => undefined);
			if (exists) {
				throw new IdentityChallengeExistsError();
			}
			await this.kv.put(key, JSON.stringify(identityChallenge), {
				expiration,
			});
			return;
		} catch (inner) {
			this.#logger.error(
				`Failed to create challenge ${identityChallenge.type} for identity ${identityChallenge.identityId}, got ${inner}`,
			);
		}
		throw new IdentityChallengeCreateError();
	}

	/**
	 * @throws {IdentityChallengeUpdateError}
	 */
	async updateChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void> {
		try {
			const key =
				`${this.prefix}/identities/${identityChallenge.identityId}/challenges/${identityChallenge.type}`;
			const exists = await this.kv.get(key).catch((_) => undefined);
			if (!exists) {
				throw new IdentityChallengeNotFoundError();
			}
			await this.kv.put(key, JSON.stringify(identityChallenge), {
				expiration,
			});
			return;
		} catch (inner) {
			this.#logger.error(
				`Failed to update challenge ${identityChallenge.type} for identity ${identityChallenge.identityId}, got ${inner}`,
			);
		}
		throw new IdentityChallengeUpdateError();
	}

	/**
	 * @throws {IdentityChallengeDeleteError}
	 */
	async deleteChallenge(
		id: AutoId,
		type: string,
	): Promise<void> {
		try {
			assertAutoId(id, IDENTITY_AUTOID_PREFIX);
			const key = `${this.prefix}/identities/${id}/challenges/${type}`;
			const exists = await this.kv.get(key).catch((_) => undefined);
			if (!exists) {
				throw new IdentityChallengeNotFoundError();
			}
			await this.kv.delete(key);
			return;
		} catch (inner) {
			this.#logger.error(
				`Failed to delete challenge ${type} for identity ${id}, got ${inner}`,
			);
		}
		throw new IdentityChallengeDeleteError();
	}
}
