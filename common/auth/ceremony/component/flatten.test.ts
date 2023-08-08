import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { flatten } from "./flatten.ts";

Deno.test("flatten", () => {
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
	const github = {
		kind: "identification" as const,
		id: "github",
		prompt: "action" as const,
	};
	const google = {
		kind: "identification" as const,
		id: "google",
		prompt: "action" as const,
	};
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
