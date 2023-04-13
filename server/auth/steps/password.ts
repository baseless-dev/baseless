import { AutoId } from "../../../shared/autoid.ts";
import { Context } from "../../context.ts";
import { AuthenticationChallenge } from "../flow.ts";

const textEncoder = new TextEncoder();

export async function hashPassword(salt: string, password: string): Promise<string> {
	const data = textEncoder.encode(salt + password + salt);
	const bufferPass1 = await crypto.subtle.digest("SHA-512", data);
	const bufferPass2 = await crypto.subtle.digest("SHA-512", bufferPass1);
	const hashBuffer = Array.from(new Uint8Array(bufferPass2));
	const hash = hashBuffer.map((b) => b.toString().padStart(2, "0"));
	return hash.join("");
}

export class AuthenticationChallengePassword extends AuthenticationChallenge {
	constructor({ icon, label }: { icon: string; label: Record<string, string> }) {
		super("password", icon, label, "password");
	}
	async challenge(request: Request, context: Context, identity: AutoId): Promise<boolean> {
		const formData = await request.formData();
		const password = formData.get("password");
		if (!password) {
			throw new Error();
		}
		const hash = await hashPassword(context.config.auth.salt, password.toString());
		return await context.identity.testIdentityChallenge(identity, "password", hash);
	}
}

export function password(options: ConstructorParameters<typeof AuthenticationChallengePassword>[0]) {
	return new AuthenticationChallengePassword(options);
}