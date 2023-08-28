import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { simplify } from "./simplify.ts";

Deno.test("simplify", () => {
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
	const otp = {
		kind: "challenge" as const,
		id: "otp",
		prompt: "otp" as const,
		digits: 6,
	};
	const github = {
		kind: "identification" as const,
		id: "github",
		prompt: "oauth2" as const,
	};
	const google = {
		kind: "identification" as const,
		id: "google",
		prompt: "oauth2" as const,
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
