import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { getComponentAtPath } from "./get_component_at_path.ts";

Deno.test("getComponentAtPath", () => {
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
		prompt: "oauth2" as const,
	};
	const google = {
		kind: "identification" as const,
		id: "google",
		prompt: "oauth2" as const,
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
