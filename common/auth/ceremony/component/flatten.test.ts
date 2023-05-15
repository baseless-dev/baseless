import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { flatten } from "./flatten.ts";

Deno.test("flatten", () => {
	const email = h.email();
	const password = h.password();
	const github = h.action({ kind: "github" });
	const google = h.action({ kind: "google" });
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
