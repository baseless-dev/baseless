import { assertEquals } from "../../deps.test.ts";
import { replace } from "./replace.ts";
import {
	type AuthenticationCeremonyComponent,
	oneOf,
	sequence,
} from "./types.ts";

Deno.test("replace", () => {
	const email: AuthenticationCeremonyComponent = {
		kind: "prompt",
		id: "email",
		prompt: "email",
		options: {},
	};
	const password: AuthenticationCeremonyComponent = {
		kind: "prompt",
		id: "password",
		prompt: "password",
		options: {},
	};

	assertEquals(
		replace(sequence(email, password), email, password),
		sequence(password, password),
	);
	assertEquals(
		replace(oneOf(email, password), email, password),
		oneOf(password, password),
	);
});
