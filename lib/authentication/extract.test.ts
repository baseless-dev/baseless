import { assertEquals } from "../../deps.test.ts";
import { extract } from "./extract.ts";
import {
	type AuthenticationCeremonyComponent,
	oneOf,
	sequence,
} from "./types.ts";

Deno.test("extract", () => {
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
	const github: AuthenticationCeremonyComponent = {
		kind: "prompt",
		id: "github",
		prompt: "oauth2",
		options: {},
	};
	const google: AuthenticationCeremonyComponent = {
		kind: "prompt",
		id: "google",
		prompt: "oauth2",
		options: {},
	};
	assertEquals(extract(email), [email]);
	assertEquals(
		extract(sequence(email, password)),
		[email, password],
	);
	assertEquals(
		extract(sequence(email, password, oneOf(github, google))),
		[email, password, github, google],
	);
	assertEquals(
		extract(
			oneOf(
				sequence(email, password, github),
				sequence(email, password, google),
			),
		),
		[email, password, github, google],
	);
});
