import type { IdentityChallenge } from "../identity/challenge.ts";
import type { IContext } from "../server/context.ts";
import type { AutoId } from "../system/autoid.ts";

export type AuthenticationChallengerConfigureIdentityChallengeOptions = {
	context: IContext;
	challenge: unknown;
};

export type AuthenticationChallengerSendChallengeOptions = {
	context: IContext;
	locale: string;
	identityId: AutoId;
	identityChallenge: IdentityChallenge;
};

export type AuthenticationChallengerVerifyOptions = {
	context: IContext;
	identityId: AutoId;
	identityChallenge: IdentityChallenge;
	challenge: unknown;
};

export type AuthenticationChallengerRateLimitOptions = {
	readonly interval: number;
	readonly count: number;
};

export abstract class AuthenticationChallenger {
	readonly rateLimit: AuthenticationChallengerRateLimitOptions = {
		count: 0,
		interval: 0,
	};
	abstract configureIdentityChallenge(
		options: AuthenticationChallengerConfigureIdentityChallengeOptions,
	): Promise<IdentityChallenge["meta"]>;
	abstract sendChallenge(
		options: AuthenticationChallengerSendChallengeOptions,
	): Promise<void>;
	abstract verify(
		options: AuthenticationChallengerVerifyOptions,
	): Promise<boolean>;
}
