import { AuthenticationRateLimitedError } from "../../common/auth/errors.ts";
import {
	assertIdentityChallenge,
	IdentityChallenge,
} from "../../common/identity/challenge.ts";
import {
	IdentityChallengeCreateError,
	// deno-lint-ignore no-unused-vars
	IdentityChallengeDeleteError,
	// deno-lint-ignore no-unused-vars
	IdentityChallengeNotFoundError,
	// deno-lint-ignore no-unused-vars
	IdentityChallengeUpdateError,
	// deno-lint-ignore no-unused-vars
	IdentityCreateError,
	// deno-lint-ignore no-unused-vars
	IdentityDeleteError,
	// deno-lint-ignore no-unused-vars
	IdentityIdentificationCreateError,
	// deno-lint-ignore no-unused-vars
	IdentityIdentificationDeleteError,
	// deno-lint-ignore no-unused-vars
	IdentityIdentificationNotFoundError,
	IdentityIdentificationUpdateError,
	// deno-lint-ignore no-unused-vars
	IdentityNotFoundError,
	// deno-lint-ignore no-unused-vars
	IdentityUpdateError,
} from "../../common/identity/errors.ts";
import {
	assertIdentityIdentification,
	IdentityIdentification,
} from "../../common/identity/identification.ts";
import { Identity } from "../../common/identity/identity.ts";
import type { Configuration } from "../../common/server/config/config.ts";
import { IIdentityService } from "../../common/server/services/identity.ts";
import { AutoId } from "../../common/system/autoid.ts";
import { CounterProvider } from "../../providers/counter.ts";
import { IdentityProvider } from "../../providers/identity.ts";
import { AuthenticationMissingChallengerError } from "../auth/config.ts";

export class IdentityService implements IIdentityService {
	#configuration: Configuration;
	#identityProvider: IdentityProvider;
	#counterProvider: CounterProvider;

	constructor(
		configuration: Configuration,
		identityProvider: IdentityProvider,
		counterProvider: CounterProvider,
	) {
		this.#configuration = configuration;
		this.#identityProvider = identityProvider;
		this.#counterProvider = counterProvider;
	}

	/**
	 * @throws {IdentityNotFoundError}
	 */
	get<Meta extends Record<string, unknown>>(
		id: AutoId,
	): Promise<Identity<Partial<Meta>>> {
		return this.#identityProvider.get(id);
	}

	/**
	 * @throws {IdentityCreateError}
	 */
	create(
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<Identity> {
		// TODO life cycle hooks
		return this.#identityProvider.create(meta, expiration);
	}

	/**
	 * @throws {IdentityUpdateError}
	 */
	update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.update(identity, expiration);
	}

	/**
	 * @throws {IdentityDeleteError}
	 */
	delete(id: AutoId): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.delete(id);
	}

	listIdentification(
		id: AutoId,
	): Promise<IdentityIdentification[]> {
		return this.#identityProvider.listIdentification(id);
	}

	/**
	 * @throws {IdentityIdentificationNotFoundError}
	 */
	matchIdentification<Meta extends Record<string, unknown>>(
		type: string,
		identification: string,
	): Promise<IdentityIdentification<Meta>> {
		return this.#identityProvider.matchIdentification(type, identification);
	}

	/**
	 * @throws {AuthenticationRateLimitedError}
	 * @throws {IdentityIdentificationCreateError}
	 */
	async createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void> {
		const key =
			`/auth/identification/${identityIdentification.type}:${identityIdentification.identification}`;
		const result = await this.#counterProvider.increment(key, 1, 5 * 60 * 1000);
		if (result > 1) {
			throw new AuthenticationRateLimitedError();
		}
		// TODO life cycle hooks
		return this.#identityProvider.createIdentification(
			identityIdentification,
			expiration,
		);
	}

	/**
	 * @throws {IdentityIdentificationUpdateError}
	 */
	updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void> {
		try {
			assertIdentityIdentification(identityIdentification);
			// TODO life cycle hooks
			return this.#identityProvider.updateIdentification(
				identityIdentification,
				expiration,
			);
		} catch (_error) {
			// skip
		}
		throw new IdentityIdentificationUpdateError();
	}

	/**
	 * @throws {IdentityIdentificationDeleteError}
	 */
	deleteIdentification(
		id: AutoId,
		type: string,
		identification: string,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.deleteIdentification(
			id,
			type,
			identification,
		);
	}

	listChallenge(id: AutoId): Promise<IdentityChallenge[]> {
		return this.#identityProvider.listChallenge(id);
	}

	/**
	 * @throws {IdentityChallengeNotFoundError}
	 */
	getChallenge<Meta extends Record<string, unknown>>(
		id: AutoId,
		type: string,
	): Promise<IdentityChallenge<Meta>> {
		return this.#identityProvider.getChallenge(id, type);
	}

	/**
	 * @throws {IdentityChallengeCreateError}
	 */
	async createChallenge(
		identityId: AutoId,
		type: string,
		challenge: string,
		expiration?: number | Date,
	): Promise<void> {
		const challenger = this.#configuration.auth.chalengers.get(type);
		if (!challenger) {
			throw new AuthenticationMissingChallengerError();
		}
		const meta = await challenger.configureMeta(challenge);
		// TODO life cycle hooks
		return this.createChallengeWithMeta({
			identityId,
			type,
			meta,
		}, expiration);
	}

	/**
	 * @throws {IdentityChallengeCreateError}
	 */
	createChallengeWithMeta(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void> {
		try {
			assertIdentityChallenge(identityChallenge);
			// TODO life cycle hooks
			return this.#identityProvider.createChallenge(
				identityChallenge,
				expiration,
			);
		} catch (_error) {
			// skip
		}
		throw new IdentityChallengeCreateError();
	}

	/**
	 * @throws {IdentityChallengeUpdateError}
	 */
	updateChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.updateChallenge(
			identityChallenge,
			expiration,
		);
	}

	/**
	 * @throws {IdentityChallengeDeleteError}
	 */
	deleteChallenge(
		id: AutoId,
		type: string,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.deleteChallenge(id, type);
	}
}
