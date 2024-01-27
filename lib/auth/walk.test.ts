import { assertEquals } from "../../deps.test.ts";
import walk from "./walk.ts";
import {
	type AuthenticationCeremonyComponent,
	oneOf,
	sequence,
} from "./types.ts";

Deno.test("walk", () => {
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

	assertEquals(
		[...walk(
			sequence(oneOf(sequence(email, password), google, github), otp),
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
			sequence(email, oneOf(password, otp), oneOf(google, github)),
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
		[...walk(oneOf(google, github))],
		[
			[google, []],
			[github, []],
		],
	);
	assertEquals(
		[...walk(sequence(email, oneOf(password, otp)))],
		[
			[email, []],
			[password, [email]],
			[email, []],
			[otp, [email]],
		],
	);
	assertEquals(
		[...walk(sequence(email, password, oneOf(google, github), otp))],
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
		[...walk(oneOf(sequence(email, password, otp), google, github))],
		[
			[email, []],
			[password, [email]],
			[otp, [email, password]],

			[google, []],

			[github, []],
		],
	);
});
