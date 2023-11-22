import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { extract } from "./extract.ts";

Deno.test("extract", () => {
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
		prompt: "oauth2" as const,
		authorizationUrl: "",
	};
	const google = {
		kind: "identification" as const,
		id: "google",
		prompt: "oauth2" as const,
		authorizationUrl: "",
	};
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
