import {
	assertIdentity,
	assertIdentityChallenge,
	assertIdentityIdentification,
	Identity,
	IdentityChallenge,
	IdentityChallengeExistsError,
	IdentityChallengeNotFoundError,
	IdentityExistsError,
	IdentityIdentification,
	IdentityIdentificationExistsError,
	IdentityIdentificationNotFoundError,
	IdentityNotFoundError,
	IdentityProvider,
} from "../../server/providers/identity.ts";
import { createLogger } from "../../server/logger.ts";
import { KeyNotFoundError, KVProvider } from "../../server/providers/kv.ts";
import { assertAutoId, AutoId, autoid } from "../../shared/autoid.ts";

export class KVIdentityProvider implements IdentityProvider {
	#logger = createLogger("baseless-identity-kv");

	public constructor(
		protected readonly kv: KVProvider,
		protected readonly prefix = "identities",
	) {
	}

	async get<Meta extends Record<string, unknown> = Record<string, unknown>>(
		id: AutoId,
	): Promise<Identity<Meta>> {
		assertAutoId(id);
		try {
			const value = await this.kv.get(`${this.prefix}/identities/${id}`);
			const identity = JSON.parse(value.value) as unknown;
			assertIdentity(identity);
			return identity as Identity<Meta>;
		} catch (inner) {
			if (inner instanceof KeyNotFoundError) {
				const err = new IdentityNotFoundError();
				err.cause = inner;
				throw err;
			}
			this.#logger.error(inner);
			throw inner;
		}
	}

	async create<Meta extends Record<string, unknown> = Record<string, unknown>>(
		meta: Meta,
		expiration?: number | Date,
	): Promise<Identity<Meta>> {
		const id = autoid();
		const identity: Identity = { id, meta };
		await this.kv.put(
			`${this.prefix}/identities/${id}`,
			JSON.stringify(identity),
			{ expiration },
		);
		return identity as Identity<Meta>;
	}

	async update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): Promise<void> {
		const exists = await this.get(identity.id).then((_) => true).catch((_) =>
			false
		);
		if (!exists) {
			throw new IdentityExistsError();
		}
		await this.kv.put(
			`${this.prefix}/identities/${identity.id}`,
			JSON.stringify(identity),
			{ expiration },
		);
	}

	async delete(id: AutoId): Promise<void> {
		assertAutoId(id);
		const exists = await this.get(id).then((_) => true).catch((_) => false);
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
		} catch (inner) {
			this.#logger.error(inner);
			throw inner;
		}
	}

	async listIdentification(id: AutoId): Promise<IdentityIdentification[]> {
		assertAutoId(id);
		const result = await this.kv.list({
			prefix: `${this.prefix}/identities/${id}/identifications/`,
		});
		return result.keys.map((key) => {
			const data = JSON.parse(key.value);
			assertIdentityIdentification(data);
			return data;
		});
	}

	async matchIdentification<
		Meta extends Record<string, unknown> = Record<string, unknown>,
	>(
		type: string,
		identification: string,
	): Promise<IdentityIdentification<Meta>> {
		const result = await this.kv.get(
			`${this.prefix}/identifications/${type}:${identification}`,
		);
		const data = JSON.parse(result.value);
		assertIdentityIdentification(data);
		return data as IdentityIdentification<Meta>;
	}

	async createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void> {
		const keyIdentity =
			`${this.prefix}/identities/${identityIdentification.identityId}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
		const keyIdentification =
			`${this.prefix}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
		const exists = await this.kv.get(keyIdentification).then((_) => true).catch(
			(_) => false,
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
	}

	async updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void> {
		const keyIdentity =
			`${this.prefix}/identities/${identityIdentification.identityId}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
		const keyIdentification =
			`${this.prefix}/identifications/${identityIdentification.type}:${identityIdentification.identification}`;
		const exists = await this.kv.get(keyIdentification).then((_) => true).catch(
			(_) => false,
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
	}

	async deleteIdentification(
		id: AutoId,
		type: string,
		identification: string,
	): Promise<void> {
		assertAutoId(id);
		const keyIdentity =
			`${this.prefix}/identities/${id}/identifications/${type}:${identification}`;
		const keyIdentification =
			`${this.prefix}/identifications/${type}:${identification}`;
		const exists = await this.kv.get(keyIdentification).then((_) => true).catch(
			(_) => false,
		);
		if (!exists) {
			throw new IdentityIdentificationNotFoundError();
		}
		try {
			await Promise.all([
				this.kv.delete(keyIdentity),
				this.kv.delete(keyIdentification),
			]);
		} catch (inner) {
			if (!(inner instanceof IdentityNotFoundError)) {
				this.#logger.error(inner);
				throw inner;
			}
		}
	}

	async listChallenge(id: AutoId): Promise<IdentityChallenge[]> {
		assertAutoId(id);
		const result = await this.kv.list({
			prefix: `${this.prefix}/identities/${id}/challenges/`,
		});
		return result.keys.map((key) => {
			const data = JSON.parse(key.value);
			assertIdentityChallenge(data);
			return data;
		});
	}

	async getChallenge<Meta extends Record<string, unknown>>(
		id: AutoId,
		type: string,
	): Promise<IdentityChallenge<Meta>> {
		assertAutoId(id);
		const result = await this.kv.get(
			`${this.prefix}/identities/${id}/challenges/${type}`,
		);
		const data = JSON.parse(result.value);
		assertIdentityChallenge(data);
		return data as IdentityChallenge<Meta>;
	}

	async createChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void> {
		const key =
			`${this.prefix}/identities/${identityChallenge.identityId}/challenges/${identityChallenge.type}`;
		const exists = await this.kv.get(key).then((_) => true).catch((_) => false);
		if (exists) {
			throw new IdentityChallengeExistsError();
		}
		await this.kv.put(key, JSON.stringify(identityChallenge), { expiration });
	}

	async updateChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void> {
		const key =
			`${this.prefix}/identities/${identityChallenge.identityId}/challenges/${identityChallenge.type}`;
		const exists = await this.kv.get(key).then((_) => true).catch((_) => false);
		if (!exists) {
			throw new IdentityChallengeNotFoundError();
		}
		await this.kv.put(key, JSON.stringify(identityChallenge), { expiration });
	}

	async deleteChallenge(
		id: AutoId,
		type: string,
	): Promise<void> {
		assertAutoId(id);
		const key = `${this.prefix}/identities/${id}/challenges/${type}`;
		const exists = await this.kv.get(key).then((_) => true).catch((_) => false);
		if (!exists) {
			throw new IdentityChallengeNotFoundError();
		}
		try {
			await this.kv.delete(key);
		} catch (inner) {
			if (!(inner instanceof IdentityNotFoundError)) {
				this.#logger.error(inner);
				throw inner;
			}
		}
	}
}
