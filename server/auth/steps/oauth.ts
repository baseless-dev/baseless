import { AutoId } from "../../../shared/autoid.ts";
import { Context } from "../../context.ts";
import { AuthenticationIdentification } from "../flow.ts";

export class AuthenticationIdentificationOAuth extends AuthenticationIdentification {
	readonly clientId: string;
	readonly clientSecret: string;
	readonly scope: string[];
	readonly authorizationEndpoint: string;
	readonly tokenEndpoint: string;
	readonly openIdEndpoint: string;
	constructor(options: {
		icon: string;
		label: Record<string, string>;
		provider: string;
		clientId: string;
		clientSecret: string;
		scope: string[];
		authorizationEndpoint: string;
		tokenEndpoint: string;
		openIdEndpoint: string;
	}) {
		super(`oauth:${options.provider}`, options.icon, options.label, "action");
		this.clientId = options.clientId;
		this.clientSecret = options.clientSecret;
		this.scope = options.scope;
		this.authorizationEndpoint = options.authorizationEndpoint;
		this.tokenEndpoint = options.tokenEndpoint;
		this.openIdEndpoint = options.openIdEndpoint;
	}
	identify(_request: Request, _context: Context): Promise<AutoId> {
		// const formData = await request.formData();
		throw new Error("Not implemented");
	}
}

export function oauth(options: ConstructorParameters<typeof AuthenticationIdentificationOAuth>[0]) {
	return new AuthenticationIdentificationOAuth(options);
}