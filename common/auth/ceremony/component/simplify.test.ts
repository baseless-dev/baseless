import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { simplify } from "./simplify.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../ceremony.ts";

Deno.test("simplify", () => {
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
	const otp: AuthenticationCeremonyComponentPrompt = {
		kind: "prompt",
		id: "otp",
		prompt: "otp",
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
	assertEquals(simplify(email), email);
	assertEquals(simplify(password), password);
	assertEquals(
		simplify(h.sequence(email, password)),
		h.sequence(email, password),
	);
	assertEquals(
		simplify(h.sequence(email, h.sequence(password, otp))),
		h.sequence(email, password, otp),
	);
	assertEquals(
		simplify(h.oneOf(email, github)),
		h.oneOf(email, github),
	);
	assertEquals(
		simplify(h.oneOf(email, h.oneOf(google, github))),
		h.oneOf(email, google, github),
	);
	assertEquals(
		simplify(
			h.oneOf(
				h.sequence(email, password),
				h.sequence(email, otp),
				h.oneOf(google, github),
			),
		),
		h.oneOf(
			h.sequence(email, password),
			h.sequence(email, otp),
			google,
			github,
		),
	);
});
