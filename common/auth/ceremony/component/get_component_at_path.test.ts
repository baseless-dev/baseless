import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { getComponentAtPath } from "./get_component_at_path.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../ceremony.ts";

Deno.test("getComponentAtPath", () => {
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
	const done = { kind: "done" as const };

	assertEquals(
		getComponentAtPath(h.sequence(email, password, done), []),
		email,
	);
	assertEquals(
		getComponentAtPath(h.sequence(email, password, done), [
			"email",
		]),
		password,
	);
	assertEquals(
		getComponentAtPath(h.sequence(email, password, done), [
			"email",
			"password",
		]),
		done,
	);
	assertEquals(
		getComponentAtPath(
			h.sequence(email, password, h.oneOf(github, google), otp, done),
			[],
		),
		email,
	);
	assertEquals(
		getComponentAtPath(
			h.sequence(email, password, h.oneOf(github, google), otp, done),
			["email"],
		),
		password,
	);
	assertEquals(
		getComponentAtPath(
			h.sequence(email, password, h.oneOf(github, google), otp, done),
			["email", "password"],
		),
		h.oneOf(github, google),
	);
	assertEquals(
		getComponentAtPath(
			h.sequence(email, password, h.oneOf(github, google), otp, done),
			["email", "password", "github"],
		),
		otp,
	);
	assertEquals(
		getComponentAtPath(
			h.sequence(email, password, h.oneOf(github, google), otp, done),
			["email", "password", "google"],
		),
		otp,
	);
	assertEquals(
		getComponentAtPath(
			h.sequence(email, password, h.oneOf(github, google), otp, done),
			["email", "password", "github", "otp"],
		),
		done,
	);
	assertEquals(
		getComponentAtPath(
			h.sequence(email, password, h.oneOf(github, google), otp, done),
			["email", "password", "google", "otp"],
		),
		done,
	);
});
