import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { getComponentAtPath } from "./get_component_at_path.ts";
import { flatten } from "./flatten.ts";

Deno.test("getComponentAtPath", () => {
	const email = h.email();
	const password = h.password();
	const otp = h.otp({ kind: "otp" });
	const github = h.action({ kind: "github" });
	const google = h.action({ kind: "google" });

	assertEquals(
		getComponentAtPath(flatten(h.sequence(email, password)), []),
		{ done: false, component: email },
	);
	assertEquals(
		getComponentAtPath(flatten(h.sequence(email, password)), [
			"email",
		]),
		{ done: false, component: password },
	);
	assertEquals(
		getComponentAtPath(flatten(h.sequence(email, password)), [
			"email",
			"password",
		]),
		{ done: true },
	);
	assertEquals(
		getComponentAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			[],
		),
		{ done: false, component: email },
	);
	assertEquals(
		getComponentAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email"],
		),
		{ done: false, component: password },
	);
	assertEquals(
		getComponentAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email", "password"],
		),
		{ done: false, component: h.oneOf(github, google) },
	);
	assertEquals(
		getComponentAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email", "password", "github"],
		),
		{ done: false, component: otp },
	);
	assertEquals(
		getComponentAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email", "password", "google"],
		),
		{ done: false, component: otp },
	);
	assertEquals(
		getComponentAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email", "password", "github", "otp"],
		),
		{ done: true },
	);
	assertEquals(
		getComponentAtPath(
			flatten(h.sequence(email, password, h.oneOf(github, google), otp)),
			["email", "password", "google", "otp"],
		),
		{ done: true },
	);
});
