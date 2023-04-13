import { AutoId } from "../../../shared/autoid.ts";
import { Context } from "../../context.ts";
import { AuthenticationIdentification } from "../flow.ts";

export class AuthenticationIdentificationEmail extends AuthenticationIdentification {
	constructor({ icon, label }: { icon: string; label: Record<string, string> }) {
		super("email", icon, label, "email");
	}
	async identify(request: Request, context: Context): Promise<AutoId> {
		const formData = await request.formData();
		const email = formData.get("email");
		if (!email) {
			throw new Error();
		}
		const identification = await context.identity.getIdentityIdentificationByType("email", email.toString());
		return identification.identityId;
	}
}

export function email(options: ConstructorParameters<typeof AuthenticationIdentificationEmail>[0]) {
	return new AuthenticationIdentificationEmail(options);
}