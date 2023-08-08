import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { replace } from "./replace.ts";

Deno.test("replace", () => {
	const email = {
		kind: "identification" as const,
		id: "email",
		prompt: "email" as const,
	};
	const password = {
		kind: "challenge" as const,
		id: "password",
		prompt: "password" as const,
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
