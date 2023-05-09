import {
	assertIdentityChallenge,
	IdentityChallenge,
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
	IdentityIdentification,
} from "../../common/identity/identification.ts";
import { assertIdentity, Identity } from "../../common/identity/identity.ts";
import { assertAutoId, AutoId, autoid } from "../../common/system/autoid.ts";
import { createLogger } from "../../common/system/logger.ts";
import { err, ok, Result } from "../../common/system/result.ts";
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
	): Promise<Result<Identity<Partial<Meta>>, IdentityNotFoundError>> {
		assertAutoId(id);
		try {
			const value = (await this.kv.get(`${this.prefix}/identities/${id}`))
				.unwrap();
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
	): Promise<Result<Identity, IdentityCreateError>> {
		try {
			const id = autoid();
			const identity: Identity = { id, meta };
			(await this.kv.put(
				`${this.prefix}/identities/${id}`,
				JSON.stringify(identity),
				{ expiration },
			)).expect();
			return ok(identity as Identity<Meta>);
		} catch (inner) {
			this.#logger.error(`Failed to create identity, got ${inner}`);
		}
		return err(new IdentityCreateError());
	}

	async update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): Promise<Result<void, IdentityUpdateError>> {
		try {
			const exists = (await this.get(identity.id)).isOk;
			if (!exists) {
				throw new IdentityExistsError();
			}
			(await this.kv.put(
				`${this.prefix}/identities/${identity.id}`,
				JSON.stringify(identity),
				{ expiration },
			)).expect();
			return ok();
		} catch (inner) {
			this.#logger.error(`Failed to update identity, got ${inner}`);
		}
		return err(new IdentityUpdateError());
	}

	async delete(id: AutoId): Promise<Result<void, IdentityDeleteError>> {
		try {
			assertAutoId(id);
			const exists = (await this.get(id)).isOk;
			if (!exists) {
				throw new IdentityExistsError();
			}
			try {
				const ops: Promise<Result<unknown, unknown>>[] = [
					this.kv.delete(`${this.prefix}/identities/${id}`),
				];
				for (
					const { type, identification } of (await this.listIdentification(id))
						.unwrap()
				) {
					ops.push(this.deleteIdentification(id, type, identification));
				}
				for (const { type } of (await this.listChallenge(id)).unwrap()) {
					ops.push(this.deleteChallenge(id, type));
				}
				for (const result of await Promise.all(ops)) {
					result.expect();
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

	async listIdentification(
		id: AutoId,
	): Promise<Result<IdentityIdentification[], never>> {
		try {
			assertAutoId(id);
			const result = (await this.kv.list({
				prefix: `${this.prefix}/identities/${id}/identifications/`,
			})).unwrap();
			return ok(result.keys.map((key) => {
				const data = JSON.parse(key.value);
				assertIdentityIdentification(data);
				return data;
			}));
		} catch (inner) {
			this.#logger.error(
				`Failed to list identifications for identity ${id}, got ${inner}`,
			);
		}
		return ok([]);
	}

	async matchIdentification<
		Meta extends Record<string, unknown> = Record<string, unknown>,
	>(
		type: string,
		identification: string,
	): Promise<
		Result<IdentityIdentification<Meta>, IdentityIdentificationNotFoundError>
	> {
		try {
			const result = (await this.kv.get(
				`${this.prefix}/identifications/${type}:${identification}`,
			)).unwrap();
			const data = JSON.parse(result.value);
			assertIdentityIdentification(data);
			return ok(data as IdentityIdentification<Meta>);
		} catch (inner) {
			this.#logger.error(
				`Failed to match identification ${type}:${identification}, got ${inner}`,
			);
		}
		return err(new IdentityIdentificationNotFoundError());
	}

	async createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<Result<void, IdentityIdentificationCreateError>> {
		try {
			const keyIdentity =
				`${this.prefix}/identities/${identityIdentification.identityId}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
			const keyIdentification =
				`${this.prefix}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
			const exists = (await this.kv.get(keyIdentification)).isOk;
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
				result.expect();
			}
			return ok();
		} catch (inner) {
			this.#logger.error(
				`Failed to create identification ${identityIdentification.type}:${identityIdentification.identification}, got ${inner}`,
			);
		}
		return err(new IdentityIdentificationCreateError());
	}

	async updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<Result<void, IdentityIdentificationUpdateError>> {
		try {
			const keyIdentity =
				`${this.prefix}/identities/${identityIdentification.identityId}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
			const keyIdentification =
				`${this.prefix}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
			const exists = (await this.kv.get(keyIdentification)).isOk;
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
				result.expect();
			}
			return ok();
		} catch (inner) {
			this.#logger.error(
				`Failed to update identification ${identityIdentification.type}:${identityIdentification.identification}, got ${inner}`,
			);
		}
		return err(new IdentityIdentificationUpdateError());
	}

	async deleteIdentification(
		id: AutoId,
		type: string,
		identification: string,
	): Promise<Result<void, IdentityIdentificationDeleteError>> {
		try {
			assertAutoId(id);
			const keyIdentity =
				`${this.prefix}/identities/${id}/identifications/${type}:${identification}`;
			const keyIdentification =
				`${this.prefix}/identifications/${type}:${identification}`;
			const exists = (await this.kv.get(keyIdentification)).isOk;
			if (!exists) {
				throw new IdentityIdentificationNotFoundError();
			}
			try {
				const results = await Promise.all([
					this.kv.delete(keyIdentity),
					this.kv.delete(keyIdentification),
				]);
				for (const result of results) {
					result.expect();
				}
				return ok();
			} catch (inner) {
				if (!(inner instanceof IdentityNotFoundError)) {
					this.#logger.error(inner);
					throw inner;
				}
			}
		} catch (inner) {
			this.#logger.error(
				`Failed to delete identification ${type}:${identification}, got ${inner}`,
			);
		}
		return err(new IdentityIdentificationDeleteError());
	}

	async listChallenge(id: AutoId): Promise<Result<IdentityChallenge[], never>> {
		try {
			assertAutoId(id);
			const result = (await this.kv.list({
				prefix: `${this.prefix}/identities/${id}/challenges/`,
			})).unwrap();
			return ok(result.keys.map((key) => {
				const data = JSON.parse(key.value);
				assertIdentityChallenge(data);
				return data;
			}));
		} catch (inner) {
			this.#logger.error(
				`Failed to list challenges for identity ${id}, got ${inner}`,
			);
		}
		return ok([]);
	}

	async getChallenge<Meta extends Record<string, unknown>>(
		id: AutoId,
		type: string,
	): Promise<Result<IdentityChallenge<Meta>, IdentityChallengeNotFoundError>> {
		try {
			assertAutoId(id);
			const result = (await this.kv.get(
				`${this.prefix}/identities/${id}/challenges/${type}`,
			)).unwrap();
			const data = JSON.parse(result.value);
			assertIdentityChallenge(data);
			return ok(data as IdentityChallenge<Meta>);
		} catch (inner) {
			this.#logger.error(
				`Failed to get challenge ${type} for identity ${id}, got ${inner}`,
			);
		}
		return err(new IdentityChallengeNotFoundError());
	}

	async createChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<Result<void, IdentityChallengeCreateError>> {
		try {
			const key =
				`${this.prefix}/identities/${identityChallenge.identityId}/challenges/${identityChallenge.type}`;
			const exists = (await this.kv.get(key)).isOk;
			if (exists) {
				throw new IdentityChallengeExistsError();
			}
			(await this.kv.put(key, JSON.stringify(identityChallenge), {
				expiration,
			})).expect();
			return ok();
		} catch (inner) {
			this.#logger.error(
				`Failed to create challenge ${identityChallenge.type} for identity ${identityChallenge.identityId}, got ${inner}`,
			);
		}
		return err(new IdentityChallengeCreateError());
	}

	async updateChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<Result<void, IdentityChallengeUpdateError>> {
		try {
			const key =
				`${this.prefix}/identities/${identityChallenge.identityId}/challenges/${identityChallenge.type}`;
			const exists = (await this.kv.get(key)).isOk;
			if (!exists) {
				throw new IdentityChallengeNotFoundError();
			}
			(await this.kv.put(key, JSON.stringify(identityChallenge), {
				expiration,
			})).expect();
			return ok();
		} catch (inner) {
			this.#logger.error(
				`Failed to update challenge ${identityChallenge.type} for identity ${identityChallenge.identityId}, got ${inner}`,
			);
		}
		return err(new IdentityChallengeUpdateError());
	}

	async deleteChallenge(
		id: AutoId,
		type: string,
	): Promise<Result<void, IdentityChallengeDeleteError>> {
		try {
			assertAutoId(id);
			const key = `${this.prefix}/identities/${id}/challenges/${type}`;
			const exists = (await this.kv.get(key)).isOk;
			if (!exists) {
				throw new IdentityChallengeNotFoundError();
			}
			(await this.kv.delete(key)).expect();
			return ok();
		} catch (inner) {
			this.#logger.error(
				`Failed to delete challenge ${type} for identity ${id}, got ${inner}`,
			);
		}
		return err(new IdentityChallengeDeleteError());
	}
}
