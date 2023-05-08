import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { getStepAtPath } from "./get_step_at_path.ts";
import { flatten } from "./flatten.ts";

Deno.test("getStepAtPath", () => {
	const email = h.email({ icon: "", label: {} });
	const password = h.password({ icon: "", label: {} });
	const otp = h.otp({ type: "otp", icon: "", label: {} });
	const github = h.action({ type: "github", icon: "", label: {} });
	const google = h.action({ type: "google", icon: "", label: {} });

	assertEquals(
		getStepAtPath(flatten(h.sequence(email, password)), []),
		{ done: false, step: email },
	);
	assertEquals(
		getStepAtPath(flatten(h.sequence(email, password)), [
			"email",
		]),
		{ done: false, step: password },
	);
	assertEquals(
		getStepAtPath(flatten(h.sequence(email, password)), [
			"email",
			"password",
		]),
		{ done: true },
	);
	assertEquals(
		getStepAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			[],
		),
		{ done: false, step: email },
	);
	assertEquals(
		getStepAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email"],
		),
		{ done: false, step: password },
	);
	assertEquals(
		getStepAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email", "password"],
		),
		{ done: false, step: h.oneOf(github, google) },
	);
	assertEquals(
		getStepAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email", "password", "github"],
		),
		{ done: false, step: otp },
	);
	assertEquals(
		getStepAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email", "password", "google"],
		),
		{ done: false, step: otp },
	);
	assertEquals(
		getStepAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email", "password", "github", "otp"],
		),
		{ done: true },
	);
	assertEquals(
		getStepAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email", "password", "google", "otp"],
		),
		{ done: true },
	);
});
