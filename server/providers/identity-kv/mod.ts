import {
	assertIdentity,
	assertIdentityAuthenticationStep,
	Identity,
	IdentityAuthenticationStep,
	IdentityAuthenticationStepExistsError,
	IdentityAuthenticationStepNotFoundError,
	IdentityExistsError,
	IdentityNotFoundError,
	IdentityProvider,
	isIdentity,
	isIdentityAuthenticationStep,
} from "../identity.ts";
import { createLogger } from "../../logger.ts";
import { KeyNotFoundError, KVProvider, KVPutOptions } from "../kv.ts";
import { assertAutoId, AutoId } from "../../../shared/autoid.ts";

export class IdentityKVProvider implements IdentityProvider {
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
			for (const { identifier, uniqueId } of await this.listStepIdentifier(identityId)) {
				ops.push(this.unassignStepIdentifier(identityId, identifier, uniqueId));
			}
			await Promise.all(ops);
		} catch (inner) {
			if (!(inner instanceof IdentityNotFoundError)) {
				this.#logger.error(inner);
				throw inner;
			}
		}
	}

	async createIdentity(identityId: AutoId, meta: Record<string, string>): Promise<void> {
		if (await this.identityExists(identityId) === true) {
			throw new IdentityExistsError();
		}
		await this.kv.put(`${this.prefix}/ident/${identityId}`, JSON.stringify({ id: identityId, meta }));
	}
	async updateIdentity(identityId: AutoId, meta: Record<string, string>): Promise<void> {
		await this.getIdentityById(identityId);
		await this.kv.put(`${this.prefix}/ident/${identityId}`, JSON.stringify({ id: identityId, meta }));
	}

	async getIdentityByStepIdentifier(identifier: string, uniqueId: string): Promise<AutoId> {
		try {
			const result = await this.kv.get(`${this.prefix}/step/${identifier}:${uniqueId}`);
			const identityId = result.value;
			assertAutoId(identityId);
			return identityId;
		} catch (inner) {
			if (inner instanceof KeyNotFoundError) {
				throw new IdentityAuthenticationStepNotFoundError();
			}
			this.#logger.error(inner);
			throw inner;
		}
	}

	async assignStepIdentifier(identityId: AutoId, identifier: string, uniqueId: string): Promise<void> {
		const stepIdentifierToIdentityId = await this.getIdentityByStepIdentifier(identifier, uniqueId).catch((_) => undefined);
		if (stepIdentifierToIdentityId && stepIdentifierToIdentityId !== identityId) {
			throw new IdentityAuthenticationStepExistsError();
		}
		await Promise.all([
			this.kv.put(`${this.prefix}/ident/${identityId}/steps/${identifier}:${uniqueId}`, identityId),
			this.kv.put(`${this.prefix}/step/${identifier}:${uniqueId}`, identityId),
		]);
	}

	async listStepIdentifier(identityId: AutoId): Promise<{ identifier: string; uniqueId: string }[]> {
		assertAutoId(identityId);
		const result = await this.kv.list({ prefix: `${this.prefix}/ident/${identityId}/steps/` });
		return result.keys.map((key) => {
			const [identifier, uniqueId] = key.key.split("/").at(-1)!.split(":");
			return { identifier, uniqueId };
		}).filter(Boolean);
	}

	async unassignStepIdentifier(identityId: AutoId, identifier: string, uniqueId: string): Promise<void> {
		await Promise.allSettled([
			this.kv.delete(`${this.prefix}/ident/${identityId}/steps/${identifier}:${uniqueId}`),
			this.kv.delete(`${this.prefix}/step/${identifier}:${uniqueId}`),
		]);
	}

	testStepChallenge(identityId: string, identifier: string, challenge: string): Promise<boolean> {
		return this.kv.get(`${this.prefix}/ident/${identityId}/challenges/${identifier}:${challenge}`).then((_) => true).catch((_) => false);
	}

	async assignStepChallenge(identityId: string, identifier: string, challenge: string, expireIn?: number): Promise<void>;
	async assignStepChallenge(identityId: string, identifier: string, challenge: string, expireAt?: Date): Promise<void>;
	async assignStepChallenge(identityId: string, identifier: string, challenge: string, expireAt?: number | Date): Promise<void> {
		let options: KVPutOptions | undefined;
		if (expireAt instanceof Date) {
			options = { expireAt };
		} else if (typeof expireAt === "number") {
			options = { expireIn: expireAt };
		}
		await this.kv.put(`${this.prefix}/ident/${identityId}/challenges/${identifier}:${challenge}`, "", options);
	}

	async listStepChallenge(identityId: AutoId): Promise<{ identifier: string; challenge: string }[]> {
		assertAutoId(identityId);
		const result = await this.kv.list({ prefix: `${this.prefix}/ident/${identityId}/challenges/` });
		return result.keys.map((key) => {
			const [identifier, challenge] = key.key.split("/").at(-1)!.split(":");
			return { identifier, challenge };
		}).filter(Boolean);
	}

	async unassignStepChallenge(identityId: string, identifier: string, challenge: string): Promise<void> {
		await this.kv.delete(`${this.prefix}/ident/${identityId}/challenges/${identifier}:${challenge}`);
	}
}
