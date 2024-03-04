import { assertEquals } from "https://deno.land/std@0.213.0/assert/mod.ts";
import { simplify } from "./simplify.ts";
import {
	type AuthenticationCeremonyComponent,
	oneOf,
	sequence,
} from "./types.ts";

Deno.test("simplify", () => {
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
	const otp: AuthenticationCeremonyComponent = {
		kind: "prompt",
		id: "otp",
		prompt: "otp",
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
	assertEquals(simplify(email), email);
	assertEquals(simplify(password), password);
	assertEquals(
		simplify(sequence(email, password)),
		sequence(email, password),
	);
	assertEquals(
		simplify(sequence(email, email)),
		email,
	);
	assertEquals(
		simplify(sequence(email, sequence(password, otp))),
		sequence(email, password, otp),
	);
	assertEquals(
		simplify(oneOf(email, github)),
		oneOf(email, github),
	);
	assertEquals(
		simplify(oneOf(email, oneOf(google, github))),
		oneOf(email, google, github),
	);
	assertEquals(
		simplify(
			oneOf(
				sequence(email, password),
				sequence(email, otp),
				oneOf(google, github),
			),
		),
		oneOf(
			sequence(email, password),
			sequence(email, otp),
			google,
			github,
		),
	);
});
