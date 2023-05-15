import type { IdentityChallenge } from "../identity/challenge.ts";
import { Context } from "../server/context.ts";

export type AuthenticationChallengerConfigureIdentityChallengeOptions = {
	context: Context;
	challenge: string;
}

export type AuthenticationChallengerSendChallengeOptions = {
	context: Context;
	locale: string;
	identityChallenge: IdentityChallenge;
}

export type AuthenticationChallengerVerifyOptions = {
	context: Context;
	identityChallenge: IdentityChallenge;
	challenge: string;
}

export abstract class AuthenticationChallenger {
	configureIdentityChallenge?: (options: AuthenticationChallengerConfigureIdentityChallengeOptions) => Promise<IdentityChallenge["meta"]> = undefined;

	sendChallenge?: (options: AuthenticationChallengerSendChallengeOptions) => Promise<void> = undefined;

	rateLimit: { interval: number; count: number } = { interval: 0, count: 0 };

	abstract verify(options: AuthenticationChallengerVerifyOptions): Promise<boolean>;
}
