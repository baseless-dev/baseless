import type { AuthenticationCeremonyComponentConditional } from "../../auth/ceremony/ceremony.ts";
import type { getComponentAtPath } from "../../auth/ceremony/component/get_component_at_path.ts";
import type { AuthenticationCeremonyResponse } from "../../auth/ceremony/response.ts";
import type { AuthenticationCeremonyState } from "../../auth/ceremony/state.ts";

export interface IAuthenticationService {
	getAuthenticationCeremony(
		state?: AuthenticationCeremonyState,
	): Promise<
		AuthenticationCeremonyResponse<
			Exclude<
				ReturnType<typeof getComponentAtPath>,
				AuthenticationCeremonyComponentConditional | undefined
			>
		>
	>;

	submitAuthenticationIdentification(
		state: AuthenticationCeremonyState,
		type: string,
		identification: unknown,
		subject: string,
	): Promise<
		AuthenticationCeremonyResponse<
			Exclude<
				ReturnType<typeof getComponentAtPath>,
				AuthenticationCeremonyComponentConditional | undefined
			>
		>
	>;

	submitAuthenticationChallenge(
		state: AuthenticationCeremonyState,
		type: string,
		challenge: unknown,
		subject: string,
	): Promise<
		AuthenticationCeremonyResponse<
			Exclude<
				ReturnType<typeof getComponentAtPath>,
				AuthenticationCeremonyComponentConditional | undefined
			>
		>
	>;
}
