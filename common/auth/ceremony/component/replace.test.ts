import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { replace } from "./replace.ts";

Deno.test("replace", () => {
	const email = { kind: "email", prompt: "email" as const };
	const password = { kind: "password", prompt: "password" as const };

	assertEquals(
		replace(h.sequence(email, password), email, password),
		h.sequence(password, password),
	);
	assertEquals(
		replace(h.oneOf(email, password), email, password),
		h.oneOf(password, password),
	);
});
