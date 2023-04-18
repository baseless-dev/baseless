import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as f from "./flow.ts";
import { Context } from "../context.ts";

Deno.test("flow", async (t) => {
	const email = f.email({ icon: "", label: {} });
	const password = f.password({ icon: "", label: {} });
	const otp = f.otp({ type: "otp", icon: "", label: {} });
	const github = f.action({ type: "github", icon: "", label: {} });
	const google = f.action({ type: "google", icon: "", label: {} });
	const conditional = f.iif((_req, _ctx, _state) => {
		return f.sequence(email, password);
	});

	await t.step("simplify", () => {
		assertEquals(f.simplify(email), email);
		assertEquals(f.simplify(password), password);
		assertEquals(
			f.simplify(f.sequence(email, password)),
			f.sequence(email, password),
		);
		assertEquals(
			f.simplify(f.sequence(email, f.sequence(password, otp))),
			f.sequence(email, password, otp),
		);
		assertEquals(
			f.simplify(f.oneOf(email, github)),
			f.oneOf(email, github),
		);
		assertEquals(
			f.simplify(f.oneOf(email, f.oneOf(google, github))),
			f.oneOf(email, google, github),
		);
		assertEquals(
			f.simplify(
				f.oneOf(
					f.sequence(email, password),
					f.sequence(email, otp),
					f.oneOf(google, github),
				),
			),
			f.oneOf(
				f.sequence(email, password),
				f.sequence(email, otp),
				google,
				github,
			),
		);
	});

	await t.step("simplifyWithContext", async () => {
		const req = new Request(new URL("http://test.local/"));
		const ctx = {} as Context;
		const state = {} as f.AuthenticationState;
		assertEquals(
			await f.simplifyWithContext(conditional, req, ctx, state),
			f.sequence(email, password),
		);
	});

	await t.step("replace", () => {
		assertEquals(
			f.replace(f.sequence(email, password), email, password),
			f.sequence(password, password),
		);
		assertEquals(
			f.replace(f.oneOf(email, password), email, password),
			f.oneOf(password, password),
		);
	});

	await t.step("flatten", () => {
		assertEquals(f.flatten(email), email);
		assertEquals(
			f.flatten(f.sequence(email, password)),
			f.sequence(email, password),
		);
		assertEquals(
			f.flatten(f.sequence(email, password, f.oneOf(github, google))),
			f.oneOf(
				f.sequence(email, password, github),
				f.sequence(email, password, google),
			),
		);
	});

	await t.step("getAuthenticationStepAtPath", () => {
		assertEquals(
			f.getAuthenticationStepAtPath(f.flatten(f.sequence(email, password)), []),
			{ done: false, step: email },
		);
		assertEquals(
			f.getAuthenticationStepAtPath(f.flatten(f.sequence(email, password)), [
				"email",
			]),
			{ done: false, step: password },
		);
		assertEquals(
			f.getAuthenticationStepAtPath(f.flatten(f.sequence(email, password)), [
				"email",
				"password",
			]),
			{ done: true },
		);
		assertEquals(
			f.getAuthenticationStepAtPath(
				f.flatten(f.sequence(email, password, f.oneOf(github, google), otp)),
				[],
			),
			{ done: false, step: email },
		);
		assertEquals(
			f.getAuthenticationStepAtPath(
				f.flatten(f.sequence(email, password, f.oneOf(github, google), otp)),
				["email"],
			),
			{ done: false, step: password },
		);
		assertEquals(
			f.getAuthenticationStepAtPath(
				f.flatten(f.sequence(email, password, f.oneOf(github, google), otp)),
				["email", "password"],
			),
			{ done: false, step: f.oneOf(github, google) },
		);
		assertEquals(
			f.getAuthenticationStepAtPath(
				f.flatten(f.sequence(email, password, f.oneOf(github, google), otp)),
				["email", "password", "github"],
			),
			{ done: false, step: otp },
		);
		assertEquals(
			f.getAuthenticationStepAtPath(
				f.flatten(f.sequence(email, password, f.oneOf(github, google), otp)),
				["email", "password", "google"],
			),
			{ done: false, step: otp },
		);
		assertEquals(
			f.getAuthenticationStepAtPath(
				f.flatten(f.sequence(email, password, f.oneOf(github, google), otp)),
				["email", "password", "github", "otp"],
			),
			{ done: true },
		);
		assertEquals(
			f.getAuthenticationStepAtPath(
				f.flatten(f.sequence(email, password, f.oneOf(github, google), otp)),
				["email", "password", "google", "otp"],
			),
			{ done: true },
		);
	});
});
