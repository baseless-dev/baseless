import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { extract } from "./extract.ts";

Deno.test("extract", () => {
	const email = { kind: "email", prompt: "email" as const };
	const password = { kind: "password", prompt: "password" as const };
	const github = { kind: "github", prompt: "action" as const };
	const google = { kind: "google", prompt: "action" as const };
	assertEquals(extract(email), [email]);
	assertEquals(
		extract(h.sequence(email, password)),
		[email, password],
	);
	assertEquals(
		extract(h.sequence(email, password, h.oneOf(github, google))),
		[email, password, github, google],
	);
	assertEquals(
		extract(
			h.oneOf(
				h.sequence(email, password, github),
				h.sequence(email, password, google),
			),
		),
		[email, password, github, google],
	);
});
