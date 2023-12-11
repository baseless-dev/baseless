import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { extract } from "./extract.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../ceremony.ts";

Deno.test("extract", () => {
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
	const github: AuthenticationCeremonyComponentPrompt = {
		kind: "prompt",
		id: "github",
		prompt: "oauth2",
		options: {},
	};
	const google: AuthenticationCeremonyComponentPrompt = {
		kind: "prompt",
		id: "google",
		prompt: "oauth2",
		options: {},
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
