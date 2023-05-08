import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { flatten } from "./flatten.ts";

Deno.test("flatten", () => {
	const email = h.email({ icon: "", label: {} });
	const password = h.password({ icon: "", label: {} });
	const github = h.action({ type: "github", icon: "", label: {} });
	const google = h.action({ type: "google", icon: "", label: {} });
	assertEquals(flatten(email), email);
	assertEquals(
		flatten(h.sequence(email, password)),
		h.sequence(email, password),
	);
	assertEquals(
		flatten(h.sequence(email, password, h.oneOf(github, google))),
		h.oneOf(
			h.sequence(email, password, github),
			h.sequence(email, password, google),
		),
	);
});
