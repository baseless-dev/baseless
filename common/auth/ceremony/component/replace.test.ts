import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { replace } from "./replace.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../ceremony.ts";

Deno.test("replace", () => {
	const email: AuthenticationCeremonyComponentPrompt = {
		kind: "prompt",
		id: "email",
		prompt: "email",
		options: {},
	};
	const password: AuthenticationCeremonyComponentPrompt = {
		kind: "prompt",
		id: "password",
		prompt: "password",
		options: {},
	};

	assertEquals(
		replace(h.sequence(email, password), email, password),
		h.sequence(password, password),
	);
	assertEquals(
		replace(h.oneOf(email, password), email, password),
		h.oneOf(password, password),
	);
});
