import type { AuthenticationCeremonyResponse } from "../../auth/ceremony/response.ts";
import type { AuthenticationCeremonyState } from "../../auth/ceremony/state.ts";
import type { AutoId } from "../../system/autoid.ts";
import type { Context } from "../context.ts";

export interface IAuthenticationService {
	getAuthenticationCeremony(
		state?: AuthenticationCeremonyState,
		context?: Context,
	): Promise<AuthenticationCeremonyResponse>;

	submitAuthenticationIdentification(
		context: Context,
		state: AuthenticationCeremonyState,
		type: string,
		identification: string,
		subject: string,
	): Promise<AuthenticationCeremonyResponse>;

	submitAuthenticationChallenge(
		context: Context,
		state: AuthenticationCeremonyState,
		type: string,
		challenge: string,
		subject: string,
	): Promise<AuthenticationCeremonyResponse>;

	sendIdentificationValidationCode(
		context: Context,
		identityId: AutoId,
		type: string,
		locale: string,
	): Promise<void>;

	confirmIdentificationValidationCode(
		identityId: AutoId,
		type: string,
		code: string,
	): Promise<void>;

	sendIdentificationChallenge(
		context: Context,
		identityId: AutoId,
		type: string,
		locale: string,
	): Promise<void>;
}
