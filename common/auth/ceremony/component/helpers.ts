import {
	assertAuthenticationCeremonyComponent,
	AuthenticationCeremonyComponent,
} from "../ceremony.ts";
import { AuthenticationCeremonyComponentChallenge } from "./challenge.ts";
import { AuthenticationCeremonyComponentConditional } from "./conditional.ts";
import { AuthenticationCeremonyComponentIdentification } from "./identification.ts";

export function sequence(...components: AuthenticationCeremonyComponent[]) {
	for (const step of components) {
		assertAuthenticationCeremonyComponent(step);
	}
	return { type: "sequence" as const, components };
}

export function oneOf(...components: AuthenticationCeremonyComponent[]) {
	for (const step of components) {
		assertAuthenticationCeremonyComponent(step);
	}
	return { type: "choice" as const, components };
}

export function iif(
	condition: AuthenticationCeremonyComponentConditional["condition"],
) {
	return { type: "conditional" as const, condition };
}

export function email(
	{ icon, label }: { icon: string; label: Record<string, string> },
): AuthenticationCeremonyComponentIdentification {
	return { type: "email", icon, label, prompt: "email" };
}

export function password(
	{ icon, label }: { icon: string; label: Record<string, string> },
): AuthenticationCeremonyComponentChallenge {
	return { type: "password", icon, label, prompt: "password" };
}

export function action(
	{ type, icon, label }: {
		type: string;
		icon: string;
		label: Record<string, string>;
	},
): AuthenticationCeremonyComponentIdentification {
	return { type, icon, label, prompt: "action" };
}

export function otp(
	{ type, icon, label }: {
		type: string;
		icon: string;
		label: Record<string, string>;
	},
): AuthenticationCeremonyComponentChallenge {
	return { type, icon, label, prompt: "otp" };
}
