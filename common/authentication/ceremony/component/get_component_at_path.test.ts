import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { getComponentAtPath } from "./get_component_at_path.ts";
import { flatten } from "./flatten.ts";

Deno.test("getComponentAtPath", () => {
	const email = h.email({ icon: "", label: {} });
	const password = h.password({ icon: "", label: {} });
	const otp = h.otp({ type: "otp", icon: "", label: {} });
	const github = h.action({ type: "github", icon: "", label: {} });
	const google = h.action({ type: "google", icon: "", label: {} });

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
