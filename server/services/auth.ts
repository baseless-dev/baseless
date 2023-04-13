import { AutoId } from "../../shared/autoid.ts";
import { CounterProvider } from "../providers/counter.ts";
import { EmailProvider } from "../providers/email.ts";
import { Identity, IdentityChallenge, IdentityIdentification, IdentityProvider } from "../providers/identity.ts";

export class AuthenticationService {
	#identityProvider: IdentityProvider;
	#counterProvider: CounterProvider;
	#emailProvider: EmailProvider;

	constructor(
		identityProvider: IdentityProvider,
		counterProvider: CounterProvider,
		emailProvider: EmailProvider
	) {
		this.#identityProvider = identityProvider;
		this.#counterProvider = counterProvider;
		this.#emailProvider = emailProvider;
	}

	getIdentityById<Meta>(identityId: AutoId): Promise<Identity<Partial<Meta>>> {
		return this.#identityProvider.getIdentityById(identityId);
	}
	createIdentity(meta: Record<string, string>): Promise<AutoId> {
		// TODO life cycle hooks
		return this.#identityProvider.createIdentity(meta);
	}
	updateIdentity(identityId: AutoId, meta: Record<string, string>): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.updateIdentity(identityId, meta);
	}
	deleteIdentity(identitityId: AutoId): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.deleteIdentityById(identitityId);
	}

	listIdentification(identityId: AutoId): Promise<IdentityIdentification[]> {
		return this.#identityProvider.listIdentityIdentification(identityId);
	}
	assignIdentification(identityId: AutoId, type: string, identification: string, expiration?: number | Date): Promise<IdentityIdentification> {
		// TODO life cycle hooks
		return this.#identityProvider.assignIdentityIdentification(identityId, type, identification, expiration);
	}
	unassignIdentification(identityId: AutoId, identificationId: AutoId): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.unassignIdentityIdentification(identityId, identificationId);
	}
	getIdentityIdentificationById(identityId: AutoId, identificationId: AutoId): Promise<IdentityIdentification> {
		return this.#identityProvider.getIdentityIdentificationById(identityId, identificationId);
	}
	getIdentityIdentificationByType(type: string, identification: string): Promise<IdentityIdentification> {
		return this.#identityProvider.getIdentityIdentificationByType(type, identification);
	}

	listChallenge(identityId: AutoId, type?: string): Promise<IdentityChallenge[]> {
		return this.#identityProvider.listIdentityChallenge(identityId, type);
	}
	assignChallenge(identitityId: AutoId, type: string, challenge: string, expiration?: number | Date): Promise<IdentityChallenge> {
		// TODO life cycle hooks
		return this.#identityProvider.assignIdentityChallenge(identitityId, type, challenge, expiration);
	}
	unassignChallenge(identityId: AutoId, challengeId: AutoId): Promise<void> {
		// TODO life cycle hooks
		return this.#identityProvider.unassignIdentityChallenge(identityId, challengeId);
	}
	forgotChallenge(_identityId: AutoId, _type: string): Promise<unknown> {
		// TODO send code to email, sms, slack, teams, discord, etc
		throw new Error(`Unimplemented.`);
	}
	resetChallenge(_identityId: AutoId, _type: string, _challenge: string): Promise<unknown> {
		// TODO reset all challenge of `type` ?
		// TODO life cycle hooks
		throw new Error(`Unimplemented.`);
	}

	// startAuthentification(): Promise<AuthentificationSession>
	// getNextAuthentificationStep(authenticationSession): Promise<PossibleSteps>
	// performAuthentificationIdentificationStep(authenticationSession, identification): Promise<IdentificationResult>
	// performAuthentificationChallengeStep(authenticationSession, challenge): Promise<ChallengeResult>

	// signOut(): Promise<void>
}