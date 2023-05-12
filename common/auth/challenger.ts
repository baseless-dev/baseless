import type { IdentityChallenge } from "../identity/challenge.ts";

export abstract class AuthenticationChallenger {
	// deno-lint-ignore require-await
	async configureMeta(_challenge: string): Promise<Record<string, unknown>> {
		return {};
	}

	sendChallenge?: (identityChallenge: IdentityChallenge) => Promise<void> =
		undefined;

	sendInterval?: number = undefined;

	sendCount?: number = undefined;

	abstract verify(
		identityChallenge: IdentityChallenge,
		challenge: string,
	): Promise<boolean>;
}
