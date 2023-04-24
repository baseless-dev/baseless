import { IdentityChallenge } from "../../providers/identity.ts";
import { AuthenticationChallenger } from "../config.ts";
import { encode } from "https://deno.land/std@0.179.0/encoding/base64.ts";

export class PasswordAuthentificationChallenger
	extends AuthenticationChallenger {
	async #hash(password: string) {
		return encode(
			await crypto.subtle.digest("SHA-512", new TextEncoder().encode(password)),
		);
	}

	async configureMeta(challenge: string): Promise<Record<string, string>> {
		const hash = await this.#hash(challenge);
		return { hash };
	}

	async verify(
		identityChallenge: IdentityChallenge,
		challenge: string,
	): Promise<boolean> {
		const hash = await this.#hash(challenge);
		return "hash" in identityChallenge.meta &&
			identityChallenge.meta.hash === hash;
	}
}
