import {
	assertIdentity,
	assertIdentityChallenge,
	assertIdentityIdentification,
	Identity,
	IdentityAuthenticationStepExistsError,
	IdentityAuthenticationStepNotFoundError,
	IdentityChallenge,
	IdentityExistsError,
	IdentityIdentification,
	IdentityNotFoundError,
	IdentityProvider,
	isIdentityChallenge,
	isIdentityIdentification,
} from "../identity.ts";
import { createLogger } from "../../logger.ts";
import { KeyNotFoundError, KVProvider, KVPutOptions } from "../kv.ts";
import { assertAutoId, autoid, AutoId } from "../../../shared/autoid.ts";

export class KVIdentityProvider implements IdentityProvider {
	#logger = createLogger("baseless-identity-kv");

	public constructor(protected readonly kv: KVProvider, protected readonly prefix = "identities") {
	}

	identityExists(identityId: AutoId): Promise<boolean> {
		assertAutoId(identityId);
		return this.getIdentityById(identityId).then((_) => true).catch((_) => false);
	}

	async getIdentityById<Meta>(identityId: AutoId): Promise<Identity<Partial<Meta>>> {
		assertAutoId(identityId);
		try {
			const value = await this.kv.get(`${this.prefix}/ident/${identityId}`);
			const identity = JSON.parse(value.value) as unknown;
			assertIdentity(identity);
			return identity;
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

	async deleteIdentityById(identityId: AutoId): Promise<void> {
		assertAutoId(identityId);
		try {
			const ops: Promise<unknown>[] = [this.kv.delete(`${this.prefix}/ident/${identityId}`)];
			for (const { id } of await this.listIdentityIdentification(identityId)) {
				ops.push(this.unassignIdentityIdentification(identityId, id));
			}
			await Promise.all(ops);
		} catch (inner) {
			if (!(inner instanceof IdentityNotFoundError)) {
				this.#logger.error(inner);
				throw inner;
			}
		}
	}

	async createIdentity(meta: Record<string, string>): Promise<AutoId> {
		const identityId = autoid();
		await this.kv.put(`${this.prefix}/ident/${identityId}`, JSON.stringify({ id: identityId, meta }));
		return identityId;
	}
	async updateIdentity(identityId: AutoId, meta: Record<string, string>): Promise<void> {
		await this.getIdentityById(identityId);
		await this.kv.put(`${this.prefix}/ident/${identityId}`, JSON.stringify({ id: identityId, meta }));
	}

	async assignIdentityIdentification(identityId: AutoId, type: string, identification: string, expiration?: number | Date): Promise<IdentityIdentification> {
		assertAutoId(identityId);
		const data: IdentityIdentification = {
			identityId,
			id: autoid(),
			identification,
			type
		};
		await Promise.all([
			this.kv.put(`${this.prefix}/ident/${identityId}/identifications/${data.id}`, JSON.stringify(data), { expiration }),
			this.kv.put(`${this.prefix}/step/${data.type}:${data.identification}`, JSON.stringify(data), { expiration }),
		]);
		return data;
	}

	async getIdentityIdentificationById(identityId: AutoId, identificationId: AutoId): Promise<IdentityIdentification> {
		assertAutoId(identityId);
		assertAutoId(identificationId);
		const result = await this.kv.get(`${this.prefix}/ident/${identityId}/identifications/${identificationId}`);
		const data = JSON.parse(result.value);
		assertIdentityIdentification(data);
		return data;
	}

	async getIdentityIdentificationByType(type: string, identification: string): Promise<IdentityIdentification> {
		try {
			const result = await this.kv.get(`${this.prefix}/step/${type}:${identification}`);
			const data = JSON.parse(result.value);
			assertIdentityIdentification(data);
			return data;
		} catch (inner) {
			if (inner instanceof KeyNotFoundError) {
				throw new IdentityAuthenticationStepNotFoundError();
			}
			this.#logger.error(inner);
			throw inner;
		}
	}

	async listIdentityIdentification(identityId: AutoId, type?: string): Promise<IdentityIdentification[]> {
		assertAutoId(identityId);
		const result = await this.kv.list({ prefix: `${this.prefix}/ident/${identityId}/identifications/` });
		return result.keys.map((key) => {
			const data = JSON.parse(key.value);
			assertIdentityIdentification(data);
			return !type || data.type === type ? data : undefined;
		}).filter(isIdentityIdentification);
	}

	async unassignIdentityIdentification(identityId: AutoId, identificationId: AutoId): Promise<void> {
		const data = await this.getIdentityIdentificationById(identityId, identificationId);
		await Promise.allSettled([
			this.kv.delete(`${this.prefix}/ident/${identityId}/identifications/${identificationId}`),
			this.kv.delete(`${this.prefix}/step/${data.type}:${data.identification}`),
		]);
	}

	async testIdentityChallenge(identityId: AutoId, type: string, challenge: string): Promise<boolean> {
		const challenges = await this.listIdentityChallenge(identityId, type);
		return challenges.some(value => value.challenge === challenge)
	}

	async assignIdentityChallenge(identityId: AutoId, type: string, challenge: string, expiration?: number | Date): Promise<IdentityChallenge> {
		assertAutoId(identityId);
		const data: IdentityChallenge = {
			identityId,
			id: autoid(),
			challenge,
			type
		};
		await this.kv.put(`${this.prefix}/ident/${identityId}/challenges/${data.id}`, JSON.stringify(data), { expiration });
		return data;
	}

	async getIdentityChallengeById(identityId: AutoId, challengeId: AutoId): Promise<IdentityChallenge> {
		assertAutoId(identityId);
		assertAutoId(challengeId);
		const result = await this.kv.get(`${this.prefix}/ident/${identityId}/challenges/${challengeId}`);
		const data = JSON.parse(result.value);
		assertIdentityChallenge(data);
		return data;
	}

	async listIdentityChallenge(identityId: AutoId, type?: string): Promise<IdentityChallenge[]> {
		assertAutoId(identityId);
		const result = await this.kv.list({ prefix: `${this.prefix}/ident/${identityId}/challenges/` });
		return result.keys.map((key) => {
			const data = JSON.parse(key.value);
			assertIdentityChallenge(data);
			return !type || data.type === type ? data : undefined;
		}).filter(isIdentityChallenge);
	}

	async unassignIdentityChallenge(identityId: AutoId, challengeId: AutoId): Promise<void> {
		assertAutoId(identityId);
		assertAutoId(challengeId);
		await this.kv.delete(`${this.prefix}/ident/${identityId}/challenges/${challengeId}`);
	}
}
