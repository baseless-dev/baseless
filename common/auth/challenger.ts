import type { IdentityChallenge } from "../identity/challenge.ts";
import type { IContext } from "../server/context.ts";
import type { AuthenticationCeremonyComponentChallenge } from "./ceremony/ceremony.ts";

export type AuthenticationChallengerConfigureIdentityChallengeOptions = {
	context: IContext;
	challenge: string;
};

export type AuthenticationChallengerSendChallengeOptions = {
	context: IContext;
	locale: string;
	identityChallenge: IdentityChallenge;
};

export type AuthenticationChallengerVerifyOptions = {
	context: IContext;
	identityChallenge: IdentityChallenge;
	challenge: string;
};

export abstract class AuthenticationChallenger
	implements AuthenticationCeremonyComponentChallenge {
	kind = "challenge" as const;
	abstract id: string;
	abstract prompt: "password" | "otp";
	toJSON(): Record<string, unknown> {
		return {
			kind: "challenge",
			id: this.id,
			prompt: this.prompt,
		};
	}
	configureIdentityChallenge?: (
		options: AuthenticationChallengerConfigureIdentityChallengeOptions,
	) => Promise<IdentityChallenge["meta"]> = undefined;

	sendChallenge?: (
		options: AuthenticationChallengerSendChallengeOptions,
	) => Promise<void> = undefined;

	rateLimit: { interval: number; count: number } = { interval: 0, count: 0 };

	abstract verify(
		options: AuthenticationChallengerVerifyOptions,
	): Promise<boolean>;
}
