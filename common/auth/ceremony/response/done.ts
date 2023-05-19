import { IDENTITY_AUTOID_PREFIX } from "../../../identity/identity.ts";
import { AutoId, isAutoId } from "../../../system/autoid.ts";
import { InvalidAuthenticationCeremonyResponseDoneError } from "../../errors.ts";

export type AuthenticationCeremonyResponseDone = {
	done: true;
	identityId: AutoId;
};

export function isAuthenticationCeremonyResponseDone(
	value?: unknown,
): value is AuthenticationCeremonyResponseDone {
	return !!value && typeof value === "object" && "done" in value &&
		value.done === true && "identityId" in value &&
		isAutoId(value.identityId, IDENTITY_AUTOID_PREFIX);
}

export function assertAuthenticationCeremonyResponseDone(
	value?: unknown,
): asserts value is AuthenticationCeremonyResponseDone {
	if (!isAuthenticationCeremonyResponseDone(value)) {
		throw new InvalidAuthenticationCeremonyResponseDoneError();
	}
}
