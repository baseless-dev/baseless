import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as f from "./flow.ts";
import { Context } from "../context.ts";

const email = f.email({ icon: "", label: {} });
const password = f.password({ icon: "", label: {} });
const otp = f.otp({ type: "otp", icon: "", label: {} });
const github = f.action({ type: "github", icon: "", label: {} });
const google = f.action({ type: "google", icon: "", label: {} });
const conditional = f.iif((_req, _ctx, _state) => {
	return f.sequence(email, password);
});

Deno.test("simplify flow", async () => {
	assertEquals(await f.simplify(email), email);
	assertEquals(await f.simplify(password), password);
	assertEquals(
		await f.simplify(f.sequence(email, password)),
		f.sequence(email, password),
	);
	assertEquals(
		await f.simplify(f.sequence(email, f.sequence(password, otp))),
		f.sequence(email, password, otp),
	);
	assertEquals(
		await f.simplify(f.oneOf(email, github)),
		f.oneOf(email, github),
	);
	assertEquals(
		await f.simplify(f.oneOf(email, f.oneOf(google, github))),
		f.oneOf(email, google, github),
	);
	assertEquals(
		await f.simplify(
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
	assertEquals(await f.simplify(conditional), conditional);
	const req = new Request(new URL("http://test.local/"));
	const ctx = {} as Context;
	const state = {} as f.AuthenticationState;
	assertEquals(
		await f.simplify(conditional, req, ctx, state),
		f.sequence(email, password),
	);
});

Deno.test("replace step", () => {
	assertEquals(
		f.replace(f.sequence(email, password), email, password),
		f.sequence(password, password),
	);
	assertEquals(
		f.replace(f.oneOf(email, password), email, password),
		f.oneOf(password, password),
	);
});

Deno.test("unique step", () => {
	assertEquals(f.unique(f.sequence(email, password, email)), [email, password]);
	assertEquals(f.unique(f.oneOf(email, password, email)), [email, password]);
	assertEquals(
		f.unique(f.oneOf(email, password, f.sequence(email, password))),
		[email, password],
	);
});

// Deno.test("flatten step", () => {
// 	assertEquals(
// 		f.flatten(f.oneOf(f.sequence(stepEmail, stepPassword), f.sequence(stepEmail, stepOTP), f.oneOf(stepGoogle, stepGithub)), req, ctx, state),
// 		f.oneOf(f.sequence(stepEmail, stepPassword), f.sequence(stepEmail, stepOTP), stepGoogle, stepGithub),
// 	);
// 	assertEquals(
// 		f.flatten(f.sequence(f.oneOf(stepEmail, stepGithub, stepGoogle), stepOTP), req, ctx, state),
// 		f.oneOf(f.sequence(stepEmail, stepOTP), f.sequence(stepGithub, stepOTP), f.sequence(stepGoogle, stepOTP)),
// 	);
// });

// Deno.test("getNextIdentificationOrChallenge", () => {
// 	assertEquals(f.getNextIdentificationOrChallenge(stepEmail).next(), { done: false, value: stepEmail });
// 	{
// 		const iter = f.getNextIdentificationOrChallenge(stepEmail);
// 		assertEquals(iter.next(), { done: false, value: stepEmail });
// 		assertEquals(iter.next(), { done: true, value: undefined });
// 	}
// 	{
// 		const iter = f.getNextIdentificationOrChallenge(f.sequence(stepEmail, stepPassword));
// 		assertEquals(iter.next(), { done: false, value: stepEmail });
// 		assertEquals(iter.next(), { done: true, value: undefined });
// 	}
// 	{
// 		const iter = f.getNextIdentificationOrChallenge(f.oneOf(stepGoogle, stepGithub));
// 		assertEquals(iter.next(), { done: false, value: stepGoogle });
// 		assertEquals(iter.next(), { done: false, value: stepGithub });
// 		assertEquals(iter.next(), { done: true, value: undefined });
// 	}
// });

// Deno.test("getNextAuthenticationStepAtPath", () => {
// 	assertEquals(f.getNextAuthenticationStepAtPath(stepEmail, []), { done: false, next: stepEmail } as any);
// 	assertEquals(f.getNextAuthenticationStepAtPath(stepPassword, []), { done: false, next: stepPassword } as any);
// 	assertEquals(f.getNextAuthenticationStepAtPath(f.sequence(stepEmail, stepPassword), []), { done: false, next: stepEmail } as any);
// 	assertEquals(f.getNextAuthenticationStepAtPath(f.sequence(stepEmail, stepPassword), ["email"]), { done: false, next: stepPassword } as any);
// 	assertEquals(f.getNextAuthenticationStepAtPath(f.sequence(stepEmail, stepPassword), ["email", "password"]), { done: true } as any);
// 	assertEquals(f.getNextAuthenticationStepAtPath(f.oneOf(stepGithub, stepGoogle), []), { done: false, next: f.oneOf(stepGithub, stepGoogle) } as any);
// 	assertEquals(f.getNextAuthenticationStepAtPath(f.oneOf(stepGithub, stepGoogle), ["oauth:google"]), { done: true });
// 	assertEquals(f.getNextAuthenticationStepAtPath(f.oneOf(stepGithub, stepGoogle), ["oauth:github"]), { done: true });
// });
