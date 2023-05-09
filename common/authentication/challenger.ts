import type { IdentityChallenge } from "../identity/challenge.ts";

export abstract class AuthenticationChallenger {
	// deno-lint-ignore require-await
	async configureMeta(_challenge: string): Promise<Record<string, string>> {
		return {};
	}

	// deno-lint-ignore no-unused-vars
	async sendChallenge(identityChallenge: IdentityChallenge): Promise<void> {}

	abstract verify(
		identityChallenge: IdentityChallenge,
		challenge: string,
	): Promise<boolean>;
}
