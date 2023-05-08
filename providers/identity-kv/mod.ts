import { IdentityChallenge, assertIdentityChallenge } from "../../common/identity/challenge.ts";
import { IdentityNotFoundError, IdentityExistsError, IdentityIdentificationExistsError, IdentityIdentificationNotFoundError, IdentityChallengeExistsError, IdentityChallengeNotFoundError, IdentityCreateError, IdentityUpdateError, IdentityDeleteError, IdentityIdentificationCreateError, IdentityIdentificationUpdateError, IdentityIdentificationDeleteError, IdentityChallengeCreateError, IdentityChallengeUpdateError, IdentityChallengeDeleteError } from "../../common/identity/errors.ts";
import { IdentityIdentification, assertIdentityIdentification } from "../../common/identity/identification.ts";
import { Identity, assertIdentity } from "../../common/identity/identity.ts";
import { AutoId, assertAutoId, autoid } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { PromisedResult, assertResultOk, err, isResultError, isResultOk, ok, unwrap } from "../../common/system/result.ts";
import { IdentityProvider } from "../identity.ts";
import { KVProvider } from "../kv.ts";

export class KVIdentityProvider implements IdentityProvider {
	#logger = createLogger("baseless-identity-kv");

	public constructor(
		protected readonly kv: KVProvider,
		protected readonly prefix = "identities",
	) {
	}

	async get<Meta extends Record<string, unknown> = Record<string, unknown>>(
		id: AutoId,
	): PromisedResult<Identity<Partial<Meta>>, IdentityNotFoundError> {
		assertAutoId(id);
		try {
			const value = unwrap(await this.kv.get(`${this.prefix}/identities/${id}`));
			const identity = JSON.parse(value.value) as unknown;
			assertIdentity(identity);
			return ok(identity as Identity<Meta>);
		} catch (inner) {
			this.#logger.error(`Failed to get identity ${id}, got ${inner}`);
		}
		return err(new IdentityNotFoundError());
	}

	async create<Meta extends Record<string, unknown> = Record<string, unknown>>(
		meta: Meta,
		expiration?: number | Date,
	): PromisedResult<Identity, IdentityCreateError> {
		try {
			const id = autoid();
			const identity: Identity = { id, meta };
			assertResultOk(await this.kv.put(
				`${this.prefix}/identities/${id}`,
				JSON.stringify(identity),
				{ expiration },
			));
			return ok(identity as Identity<Meta>);
		} catch (inner) {
			this.#logger.error(`Failed to create identity, got ${inner}`);
		}
		return err(new IdentityCreateError());
	}

	async update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): PromisedResult<void, IdentityUpdateError> {
		try {
			const exists = isResultOk(await this.get(identity.id));
			if (!exists) {
				throw new IdentityExistsError();
			}
			assertResultOk(await this.kv.put(
				`${this.prefix}/identities/${identity.id}`,
				JSON.stringify(identity),
				{ expiration },
			));
		} catch (inner) {
			this.#logger.error(`Failed to update identity, got ${inner}`);
		}
		return err(new IdentityUpdateError());
	}

	async delete(id: AutoId): PromisedResult<void, IdentityDeleteError> {
		try {
			assertAutoId(id);
			const exists = isResultOk(await this.get(id));
			if (!exists) {
				throw new IdentityExistsError();
			}
			try {
				const ops: PromisedResult<unknown, unknown>[] = [
					this.kv.delete(`${this.prefix}/identities/${id}`),
				];
				for (
					const { type, identification } of unwrap(await this.listIdentification(id))
				) {
					ops.push(this.deleteIdentification(id, type, identification));
				}
				for (const { type } of unwrap(await this.listChallenge(id))) {
					ops.push(this.deleteChallenge(id, type));
				}
				for (const result of await Promise.all(ops)) {
					assertResultOk(result);
				}
				return ok();
			} catch (inner) {
				this.#logger.error(inner);
				throw inner;
			}
		} catch (inner) {
			this.#logger.error(`Failed to delete identity ${id}, got ${inner}`);
		}
		return err(new IdentityDeleteError());
	}

	async listIdentification(id: AutoId): PromisedResult<IdentityIdentification[], never> {
		try {
			assertAutoId(id);
			const result = unwrap(await this.kv.list({
				prefix: `${this.prefix}/identities/${id}/identifications/`,
			}));
			return ok(result.keys.map((key) => {
				const data = JSON.parse(key.value);
				assertIdentityIdentification(data);
				return data;
			}));
		} catch (inner) {
			this.#logger.error(`Failed to list identifications for identity ${id}, got ${inner}`);
		}
		return ok([]);
	}

	async matchIdentification<
		Meta extends Record<string, unknown> = Record<string, unknown>,
	>(
		type: string,
		identification: string,
	): PromisedResult<IdentityIdentification<Meta>, IdentityIdentificationNotFoundError> {
		try {
			const result = unwrap(await this.kv.get(
				`${this.prefix}/identifications/${type}:${identification}`,
			));
			const data = JSON.parse(result.value);
			assertIdentityIdentification(data);
			return ok(data as IdentityIdentification<Meta>);
		} catch (inner) {
			this.#logger.error(`Failed to match identification ${type}:${identification}, got ${inner}`);
		}
		return err(new IdentityIdentificationNotFoundError());
	}

	async createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): PromisedResult<void, IdentityIdentificationCreateError> {
		try {
			const keyIdentity =
				`${this.prefix}/identities/${identityIdentification.identityId}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
			const keyIdentification =
				`${this.prefix}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
			const exists = isResultOk(await this.kv.get(keyIdentification));
			if (exists) {
				throw new IdentityIdentificationExistsError();
			}
			const results = await Promise.all([
				this.kv.put(keyIdentity, JSON.stringify(identityIdentification), {
					expiration,
				}),
				this.kv.put(keyIdentification, JSON.stringify(identityIdentification), {
					expiration,
				}),
			]);
			for (const result of results) {
				assertResultOk(result);
			}
			return ok();
		} catch (inner) {
			this.#logger.error(`Failed to create identification ${identityIdentification.type}:${identityIdentification.identification}, got ${inner}`);
		}
		return err(new IdentityIdentificationCreateError());
	}

	async updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): PromisedResult<void, IdentityIdentificationUpdateError> {
		try {
			const keyIdentity =
				`${this.prefix}/identities/${identityIdentification.identityId}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
			const keyIdentification =
				`${this.prefix}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
			const exists = isResultOk(await this.kv.get(keyIdentification));
			if (!exists) {
				throw new IdentityIdentificationNotFoundError();
			}
			const results = await Promise.all([
				this.kv.put(keyIdentity, JSON.stringify(identityIdentification), {
					expiration,
				}),
				this.kv.put(keyIdentification, JSON.stringify(identityIdentification), {
					expiration,
				}),
			]);
			for (const result of results) {
				assertResultOk(result);
			}
			return ok();
		} catch (inner) {
			this.#logger.error(`Failed to update identification ${identityIdentification.type}:${identityIdentification.identification}, got ${inner}`);
		}
		return err(new IdentityIdentificationUpdateError());
	}

	async deleteIdentification(
		id: AutoId,
		type: string,
		identification: string,
	): PromisedResult<void, IdentityIdentificationDeleteError> {
		try {
			assertAutoId(id);
			const keyIdentity =
				`${this.prefix}/identities/${id}/identifications/${type}:${identification}`;
			const keyIdentification =
				`${this.prefix}/identifications/${type}:${identification}`;
			const exists = isResultOk(await this.kv.get(keyIdentification));
			if (!exists) {
				throw new IdentityIdentificationNotFoundError();
			}
			try {
				const results = await Promise.all([
					this.kv.delete(keyIdentity),
					this.kv.delete(keyIdentification),
				]);
				for (const result of results) {
					assertResultOk(result);
				}
				return ok();
			} catch (inner) {
				if (!(inner instanceof IdentityNotFoundError)) {
					this.#logger.error(inner);
					throw inner;
				}
			}
		} catch (inner) {
			this.#logger.error(`Failed to delete identification ${type}:${identification}, got ${inner}`);
		}
		return err(new IdentityIdentificationDeleteError());
	}

	async listChallenge(id: AutoId): PromisedResult<IdentityChallenge[], never> {
		try {
			assertAutoId(id);
			const result = unwrap(await this.kv.list({
				prefix: `${this.prefix}/identities/${id}/challenges/`,
			}));
			return ok(result.keys.map((key) => {
				const data = JSON.parse(key.value);
				assertIdentityChallenge(data);
				return data;
			}));
		} catch (inner) {
			this.#logger.error(`Failed to list challenges for identity ${id}, got ${inner}`);
		}
		return ok([]);
	}

	async getChallenge<Meta extends Record<string, unknown>>(
		id: AutoId,
		type: string,
	): PromisedResult<IdentityChallenge<Meta>, IdentityChallengeNotFoundError> {
		try {
			assertAutoId(id);
			const result = unwrap(await this.kv.get(
				`${this.prefix}/identities/${id}/challenges/${type}`,
			));
			const data = JSON.parse(result.value);
			assertIdentityChallenge(data);
			return ok(data as IdentityChallenge<Meta>);
		} catch (inner) {
			this.#logger.error(`Failed to get challenge ${type} for identity ${id}, got ${inner}`);
		}
		return err(new IdentityChallengeNotFoundError());
	}

	async createChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): PromisedResult<void, IdentityChallengeCreateError> {
		try {
			const key =
				`${this.prefix}/identities/${identityChallenge.identityId}/challenges/${identityChallenge.type}`;
			const exists = isResultOk(await this.kv.get(key));
			if (exists) {
				throw new IdentityChallengeExistsError();
			}
			assertResultOk(await this.kv.put(key, JSON.stringify(identityChallenge), { expiration }));
			return ok();
		} catch (inner) {
			this.#logger.error(`Failed to create challenge ${identityChallenge.type} for identity ${identityChallenge.identityId}, got ${inner}`);
		}
		return err(new IdentityChallengeCreateError());
	}

	async updateChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): PromisedResult<void, IdentityChallengeUpdateError> {
		try {
			const key =
				`${this.prefix}/identities/${identityChallenge.identityId}/challenges/${identityChallenge.type}`;
			const exists = isResultOk(await this.kv.get(key));
			if (!exists) {
				throw new IdentityChallengeNotFoundError();
			}
			assertResultOk(await this.kv.put(key, JSON.stringify(identityChallenge), { expiration }));
			return ok();
		} catch (inner) {
			this.#logger.error(`Failed to update challenge ${identityChallenge.type} for identity ${identityChallenge.identityId}, got ${inner}`);
		}
		return err(new IdentityChallengeUpdateError());
	}

	async deleteChallenge(
		id: AutoId,
		type: string,
	): PromisedResult<void, IdentityChallengeDeleteError> {
		try {
			assertAutoId(id);
			const key = `${this.prefix}/identities/${id}/challenges/${type}`;
			const exists = unwrap(await this.kv.get(key));
			if (!exists) {
				throw new IdentityChallengeNotFoundError();
			}
			await this.kv.delete(key)
			return ok();
		} catch (inner) {
			this.#logger.error(`Failed to delete challenge ${type} for identity ${id}, got ${inner}`);
		}
		return err(new IdentityChallengeDeleteError());
	}
}
