import { AutoId } from "../../shared/autoid.ts";
import { AuthenticationMissingChallengerError } from "../auth/config.ts";
import { Configuration } from "../config.ts";
import { NonExtendableContext } from "../context.ts";
import {
	Identity,
	IdentityChallenge,
	IdentityIdentification,
	IdentityProvider,
} from "../providers/identity.ts";

export class IdentityService {
	#configuration: Configuration;
	#identityProvider: IdentityProvider;

	constructor(
		configuration: Configuration,
		identityProvider: IdentityProvider,
	) {
		this.#configuration = configuration;
		this.#identityProvider = identityProvider;
	}

	get<Meta extends Record<string, unknown>>(
		id: AutoId,
	): Promise<Identity<Partial<Meta>>> {
		return this.#identityProvider.get(id);
	}

	create(
		meta: Record<string, unknown>,
		expiration?: number | Date,
	): Promise<Identity> {
		// TODO life cycle hooks
		return this.#identityProvider.create(meta, expiration);
	}

	update(
		identity: Identity<Record<string, unknown>>,
		expiration?: number | Date,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.update(identity, expiration);
	}

	delete(id: AutoId): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.delete(id);
	}

	listIdentification(id: AutoId): Promise<IdentityIdentification[]> {
		return this.#identityProvider.listIdentification(id);
	}

	getIdentification<Meta extends Record<string, unknown>>(
		type: string,
		identification: string,
	): Promise<IdentityIdentification<Meta>> {
		return this.#identityProvider.getIdentification(type, identification);
	}

	createIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.createIdentification(
			identityIdentification,
			expiration,
		);
	}

	updateIdentification(
		identityIdentification: IdentityIdentification,
		expiration?: number | Date,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.updateIdentification(
			identityIdentification,
			expiration,
		);
	}

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

	getChallenge<Meta extends Record<string, unknown>>(
		id: AutoId,
		type: string,
	): Promise<IdentityChallenge<Meta>> {
		return this.#identityProvider.getChallenge(id, type);
	}

	createChallenge(
		identityChallenge: IdentityChallenge,
		expiration?: number | Date,
	): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.createChallenge(
			identityChallenge,
			expiration,
		);
	}

	async createChallengeWithRequest(
		identityId: AutoId,
		type: string,
		request: Request,
		expiration?: number | Date,
	): Promise<void> {
		const challenger = this.#configuration.auth.flow.chalengers.get(type);
		if (!challenger) {
			throw new AuthenticationMissingChallengerError();
		}
		const meta = await challenger.prepareMetaForRequest(request);
		// TODO life cycle hooks
		return this.#identityProvider.createChallenge(
			{ identityId, type, meta },
			expiration,
		);
	}

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

	deleteChallenge(id: AutoId, type: string): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.deleteChallenge(id, type);
	}
}
