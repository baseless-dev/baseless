import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import walk from "./walk.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../ceremony.ts";

Deno.test("walk", () => {
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

	assertEquals(
		[...walk(
			h.sequence(h.oneOf(h.sequence(email, password), google, github), otp),
		)],
		[
			[email, []],
			[password, [email]],
			[otp, [email, password]],
			[google, []],
			[otp, [google]],
			[github, []],
			[otp, [github]],
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

			[email, []],
			[password, [email]],
			[github, [email, password]],

			[email, []],
			[otp, [email]],
			[google, [email, otp]],

			[email, []],
			[otp, [email]],
			[github, [email, otp]],
		],
	);

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
			[email, []],
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

			[email, []],
			[password, [email]],
			[github, [email, password]],
			[otp, [email, password, github]],
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
});
