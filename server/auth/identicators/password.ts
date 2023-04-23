import { Context, NonExtendableContext } from "../../context.ts";
import { AuthenticationChallenger } from "../config.ts";
import { AuthenticationStateIdentified } from "../flow.ts";
import { encode } from "https://deno.land/std@0.179.0/encoding/base64.ts";

export class PasswordAuthentificationChallenger
	extends AuthenticationChallenger {
	async #hash(password: string) {
		return encode(
			await crypto.subtle.digest("SHA-512", new TextEncoder().encode(password)),
		);
	}

	async prepareMetaForRequest(
		request: Request,
	): Promise<Record<string, string>> {
		const formData = await request.formData();
		const password = formData.get("password")?.toString() ?? "";
		const hash = await this.#hash(password);
		return { hash };
	}

	async challenge(
		context: NonExtendableContext,
		state: AuthenticationStateIdentified,
		request: Request,
	): Promise<boolean> {
		const formData = await request.formData();
		const password = formData.get("password")?.toString() ?? "";
		const challenge = await context.identity.getChallenge(
			state.identity ?? "",
			"password",
		);
		const hash = await this.#hash(password);
		return "hash" in challenge.meta && challenge.meta.hash === hash;
	}
}
