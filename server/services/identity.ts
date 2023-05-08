import { AuthenticationRateLimitedError } from "../../common/authentication/errors.ts";
import { IdentityChallenge, assertIdentityChallenge } from "../../common/identity/challenge.ts";
import { IdentityChallengeCreateError, IdentityChallengeDeleteError, IdentityChallengeNotFoundError, IdentityChallengeUpdateError, IdentityCreateError, IdentityDeleteError, IdentityIdentificationCreateError, IdentityIdentificationDeleteError, IdentityIdentificationExistsError, IdentityIdentificationNotFoundError, IdentityIdentificationUpdateError, IdentityNotFoundError, IdentityUpdateError } from "../../common/identity/errors.ts";
import { IdentityIdentification, assertIdentityIdentification } from "../../common/identity/identification.ts";
import { Identity } from "../../common/identity/identity.ts";
import { AutoId } from "../../common/system/autoid.ts";
import { PromisedResult, err, isResultError } from "../../common/system/result.ts";
import { CounterProvider } from "../../providers/counter.ts";
import { IdentityProvider } from "../../providers/identity.ts";
import { AuthenticationMissingChallengerError } from "../auth/config.ts";
import { Configuration } from "../config.ts";

export class IdentityService {
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

	get<Meta extends Record<string, unknown>>(
		id: AutoId,
	): PromisedResult<Identity<Partial<Meta>>, IdentityNotFoundError> {
		return this.#identityProvider.get(id);
	}

	create(
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): PromisedResult<Identity, IdentityCreateError> {
		// TODO life cycle hooks
		return this.#identityProvider.create(meta, expiration);
	}

	update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): PromisedResult<void, IdentityUpdateError> {
		// TODO life cycle hooks
		return this.#identityProvider.update(identity, expiration);
	}

	delete(id: AutoId): PromisedResult<void, IdentityDeleteError> {
		// TODO life cycle hooks
		return this.#identityProvider.delete(id);
	}

	listIdentification(id: AutoId): PromisedResult<IdentityIdentification[], never> {
		return this.#identityProvider.listIdentification(id);
	}

	matchIdentification<Meta extends Record<string, unknown>>(
		type: string,
		identification: string,
	): PromisedResult<IdentityIdentification<Meta>, IdentityIdentificationNotFoundError> {
		return this.#identityProvider.matchIdentification(type, identification);
	}

	async createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): PromisedResult<void, AuthenticationRateLimitedError | IdentityIdentificationCreateError> {
		const key =
			`/auth/identification/${identityIdentification.type}:${identityIdentification.identification}`;
		const result = await this.#counterProvider.increment(key, 1, 5 * 60 * 1000);
		if (isResultError(result)) {
			return err(new IdentityIdentificationCreateError());
		} else if (result.value > 1) {
			return err(new AuthenticationRateLimitedError());
		}
		// TODO life cycle hooks
		return this.#identityProvider.createIdentification(
			identityIdentification,
			expiration,
		);
	}

	updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): PromisedResult<void, IdentityIdentificationUpdateError> {
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
		return Promise.resolve(err(new IdentityIdentificationUpdateError()));
	}

	deleteIdentification(
		id: AutoId,
		type: string,
		identification: string,
	): PromisedResult<void, IdentityIdentificationDeleteError> {
		// TODO life cycle hooks
		return this.#identityProvider.deleteIdentification(
			id,
			type,
			identification,
		);
	}

	listChallenge(id: AutoId): PromisedResult<IdentityChallenge[], never> {
		return this.#identityProvider.listChallenge(id);
	}

	getChallenge<Meta extends Record<string, unknown>>(
		id: AutoId,
		type: string,
	): PromisedResult<IdentityChallenge<Meta>, IdentityChallengeNotFoundError> {
		return this.#identityProvider.getChallenge(id, type);
	}

	async createChallenge(
		identityId: AutoId,
		type: string,
		challenge: string,
		expiration?: number | Date,
	): PromisedResult<void, IdentityChallengeCreateError> {
		const challenger = this.#configuration.auth.flow.chalengers.get(type);
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

	createChallengeWithMeta(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): PromisedResult<void, IdentityChallengeCreateError> {
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
		return Promise.resolve(err(new IdentityChallengeCreateError()));
	}

	updateChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): PromisedResult<void, IdentityChallengeUpdateError> {
		// TODO life cycle hooks
		return this.#identityProvider.updateChallenge(
			identityChallenge,
			expiration,
		);
	}

	deleteChallenge(id: AutoId, type: string): PromisedResult<void, IdentityChallengeDeleteError> {
		// TODO life cycle hooks
		return this.#identityProvider.deleteChallenge(id, type);
	}
}
