import { NonExtendableContext } from "../../context.ts";
import { AuthenticationIdenticator } from "../config.ts";
import { AuthenticationState } from "../flow.ts";

export class EmailAuthentificationIdenticator
	extends AuthenticationIdenticator {
	async identify(
		context: NonExtendableContext,
		_state: AuthenticationState,
		request: Request,
	): Promise<string | Response> {
		const formData = await request.formData();
		const email = formData.get("email")?.toString() ?? "";
		const identityIdentification = await context.identity.getIdentification(
			"email",
			email,
		);
		return identityIdentification.identityId;
	}
}
