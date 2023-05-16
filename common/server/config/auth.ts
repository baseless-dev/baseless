import type { KeyLike } from "https://deno.land/x/jose@v4.13.1/types.d.ts";
import { AuthenticationCeremonyComponent } from "../../auth/ceremony/ceremony.ts";
import { AuthenticationChallenger } from "../../auth/challenger.ts";
import { AuthenticationIdenticator } from "../../auth/identicator.ts";
import { Identity } from "../../identity/identity.ts";
import { IContext } from "../context.ts";

export type AuthenticationKeys = {
	readonly algo: string;
	readonly privateKey: KeyLike;
	readonly publicKey: KeyLike;
};

export type AuthenticationConfiguration = {
	readonly enabled: boolean;
	readonly security: {
		readonly keys: AuthenticationKeys;
		readonly salt: string;
		readonly rateLimit: {
			readonly identificationCount: number;
			readonly identificationInterval: number;
			readonly challengeCount: number;
			readonly challengeInterval: number;
			readonly confirmVerificationCodeCount: number;
			readonly confirmVerificationCodeInterval: number;
		};
	};
	readonly ceremony: AuthenticationCeremonyComponent;
	readonly identificators: Map<string, AuthenticationIdenticator>;
	readonly challengers: Map<string, AuthenticationChallenger>;
	readonly onCreateIdentity?: AuthenticationHandler;
	readonly onUpdateIdentity?: AuthenticationHandler;
	readonly onDeleteIdentity?: AuthenticationHandler;
};

export type AuthenticationHandler = (
	context: IContext,
	request: Request,
	identity: Identity,
) => void | Promise<void>;
export type AuthenticationViewPrompParams = {
	request: Request;
	context: IContext;
	step: AuthenticationCeremonyComponent;
	isFirstStep: boolean;
	isLastStep: boolean;
};
