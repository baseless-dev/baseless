import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { flatten } from "./flatten.ts";

Deno.test("flatten", () => {
	const email = { kind: "email", prompt: "email" as const };
	const password = { kind: "password", prompt: "password" as const };
	const github = { kind: "github", prompt: "action" as const };
	const google = { kind: "google", prompt: "action" as const };
	assertEquals(flatten(email), email);
	assertEquals(
		flatten(h.sequence(email, password)),
		h.sequence(email, password),
	);
	assertEquals(
		flatten(h.sequence(email, password, h.oneOf(github, google))),
		h.oneOf(
			h.sequence(email, password, github),
			h.sequence(email, password, google),
		),
	);
});
