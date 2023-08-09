import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import walk from "./walk.ts";

Deno.test("walk", () => {
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
	const otp = { kind: "challenge" as const, id: "otp", prompt: "otp" as const };
	const github = {
		kind: "identification" as const,
		id: "github",
		prompt: "action" as const,
	};
	const google = {
		kind: "identification" as const,
		id: "google",
		prompt: "action" as const,
	};

	assertEquals(
		[...walk(h.oneOf(google, github))],
		[
			[google, []],
			[github, []],
		],
	);
	assertEquals(
		[...walk(h.sequence(email, h.oneOf(password, otp)))],
		[
			[email, []],
			[password, [email]],
			[otp, [email]],
		],
	);
	assertEquals(
		[...walk(h.sequence(email, password, h.oneOf(google, github), otp))],
		[
			[email, []],
			[password, [email]],

			[google, [email, password]],
			[otp, [email, password, google]],

			[github, [email, password]],
			[otp, [email, password, github]],
		],
	);
	assertEquals(
		[...walk(h.sequence(email, password))],
		[
			[email, []],
			[password, [email]],
		],
	);
	assertEquals(
		[...walk(h.oneOf(h.sequence(email, password, otp), google, github))],
		[
			[email, []],
			[password, [email]],
			[otp, [email, password]],

			[google, []],

			[github, []],
		],
	);

	assertEquals(
		[...walk(
			h.sequence(email, h.oneOf(password, otp), h.oneOf(google, github)),
		)],
		[
			[email, []],

			[password, [email]],
			[google, [email, password]],
			[github, [email, password]],

			[otp, [email]],
			[google, [email, otp]],
			[github, [email, otp]],
		],
	);
	assertEquals(
		[...walk(
			h.sequence(h.oneOf(h.sequence(email, password), google, github), otp),
		)],
		[
			[email, []],
			[password, [email]],
			[otp, [email, password]],
		],
	);
});
