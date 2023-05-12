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
		state: AuthenticationCeremonyState,
		type: string,
		identification: string,
		subject: string,
	): Promise<AuthenticationCeremonyResponse>;

	submitAuthenticationChallenge(
		state: AuthenticationCeremonyState,
		type: string,
		challenge: string,
		subject: string,
	): Promise<AuthenticationCeremonyResponse>;

	sendIdentificationValidationCode(
		identityId: AutoId,
		type: string,
	): Promise<void>;

	confirmIdentificationValidationCode(
		identityId: AutoId,
		type: string,
		code: string,
	): Promise<void>;

	sendIdentificationChallenge(
		identityId: AutoId,
		type: string,
	): Promise<void>;
}
