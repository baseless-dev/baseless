import { assertEquals } from "../../deps.test.ts";
import { getComponentAtPath } from "./get_component_at_path.ts";
import {
	type AuthenticationCeremonyComponent,
	oneOf,
	sequence,
} from "./types.ts";

Deno.test("getComponentAtPath", () => {
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
	const done = { kind: "done" as const };

	assertEquals(
		getComponentAtPath(sequence(email, password, done), []),
		email,
	);
	assertEquals(
		getComponentAtPath(sequence(email, password, done), [
			"email",
		]),
		password,
	);
	assertEquals(
		getComponentAtPath(sequence(email, password, done), [
			"email",
			"password",
		]),
		done,
	);
	assertEquals(
		getComponentAtPath(
			sequence(email, password, oneOf(github, google), otp, done),
			[],
		),
		email,
	);
	assertEquals(
		getComponentAtPath(
			sequence(email, password, oneOf(github, google), otp, done),
			["email"],
		),
		password,
	);
	assertEquals(
		getComponentAtPath(
			sequence(email, password, oneOf(github, google), otp, done),
			["email", "password"],
		),
		oneOf(github, google),
	);
	assertEquals(
		getComponentAtPath(
			sequence(email, password, oneOf(github, google), otp, done),
			["email", "password", "github"],
		),
		otp,
	);
	assertEquals(
		getComponentAtPath(
			sequence(email, password, oneOf(github, google), otp, done),
			["email", "password", "google"],
		),
		otp,
	);
	assertEquals(
		getComponentAtPath(
			sequence(email, password, oneOf(github, google), otp, done),
			["email", "password", "github", "otp"],
		),
		done,
	);
	assertEquals(
		getComponentAtPath(
			sequence(email, password, oneOf(github, google), otp, done),
			["email", "password", "google", "otp"],
		),
		done,
	);
});
