// deno-lint-ignore-file no-explicit-any
import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as f from "./flow.ts";
import { email } from "./steps/email.ts";
import { password } from "./steps/password.ts";
import { oauth } from "./steps/oauth.ts";
import { otpLogger } from "./steps/otp-logger.ts";

const stepEmail = email({ icon: "", label: {} });
const stepPassword = password({ icon: "", label: {} });
const stepOTP = otpLogger({ icon: "", label: {} });
const stepGithub = oauth({
	icon: "",
	label: {},
	provider: "github",
	clientId: "",
	clientSecret: "",
	scope: [],
	authorizationEndpoint: "",
	tokenEndpoint: "",
	openIdEndpoint: "",
});
const stepGoogle = oauth({
	icon: "",
	label: {},
	provider: "google",
	clientId: "",
	clientSecret: "",
	scope: [],
	authorizationEndpoint: "",
	tokenEndpoint: "",
	openIdEndpoint: "",
});

Deno.test("simplify flow", () => {
	assertEquals(f.simplify(stepEmail), stepEmail);
	assertEquals(f.simplify(stepPassword), stepPassword);
	assertEquals(f.simplify(f.sequence(stepEmail, stepPassword)), f.sequence(stepEmail, stepPassword));
	assertEquals(f.simplify(f.sequence(stepEmail, f.sequence(stepPassword, stepOTP))), f.sequence(stepEmail, stepPassword, stepOTP));
	assertEquals(f.simplify(f.oneOf(stepEmail, stepGithub)), f.oneOf(stepEmail, stepGithub));
	assertEquals(f.simplify(f.oneOf(stepEmail, f.oneOf(stepGoogle, stepGithub))), f.oneOf(stepEmail, stepGoogle, stepGithub));
	assertEquals(
		f.simplify(f.oneOf(f.sequence(stepEmail, stepPassword), f.sequence(stepEmail, stepOTP), f.oneOf(stepGoogle, stepGithub))),
		f.oneOf(f.sequence(stepEmail, stepPassword), f.sequence(stepEmail, stepOTP), stepGoogle, stepGithub),
	);
});

Deno.test("replace step", () => {
	assertEquals(f.replace(f.sequence(stepEmail, stepPassword), stepEmail, stepPassword), f.sequence(stepPassword, stepPassword));
	assertEquals(f.replace(f.oneOf(stepEmail, stepPassword), stepEmail, stepPassword), f.oneOf(stepPassword, stepPassword));
});

Deno.test("flatten step", () => {
	assertEquals(
		f.flatten(f.oneOf(f.sequence(stepEmail, stepPassword), f.sequence(stepEmail, stepOTP), f.oneOf(stepGoogle, stepGithub))),
		f.oneOf(f.sequence(stepEmail, stepPassword), f.sequence(stepEmail, stepOTP), stepGoogle, stepGithub),
	);
	assertEquals(
		f.flatten(f.sequence(f.oneOf(stepEmail, stepGithub, stepGoogle), stepOTP)),
		f.oneOf(f.sequence(stepEmail, stepOTP), f.sequence(stepGithub, stepOTP), f.sequence(stepGoogle, stepOTP)),
	);
});

Deno.test("getNextIdentificationOrChallenge", () => {
	assertEquals(f.getNextIdentificationOrChallenge(stepEmail).next(), { done: false, value: stepEmail });
	{
		const iter = f.getNextIdentificationOrChallenge(stepEmail);
		assertEquals(iter.next(), { done: false, value: stepEmail });
		assertEquals(iter.next(), { done: true, value: undefined });
	}
	{
		const iter = f.getNextIdentificationOrChallenge(f.sequence(stepEmail, stepPassword));
		assertEquals(iter.next(), { done: false, value: stepEmail });
		assertEquals(iter.next(), { done: true, value: undefined });
	}
	{
		const iter = f.getNextIdentificationOrChallenge(f.oneOf(stepGoogle, stepGithub));
		assertEquals(iter.next(), { done: false, value: stepGoogle });
		assertEquals(iter.next(), { done: false, value: stepGithub });
		assertEquals(iter.next(), { done: true, value: undefined });
	}
});

Deno.test("getNextAuthenticationStepAtPath", () => {
	assertEquals(f.getNextAuthenticationStepAtPath(stepEmail, []), { done: false, next: stepEmail } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(stepPassword, []), { done: false, next: stepPassword } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(f.sequence(stepEmail, stepPassword), []), { done: false, next: stepEmail } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(f.sequence(stepEmail, stepPassword), ["email"]), { done: false, next: stepPassword } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(f.sequence(stepEmail, stepPassword), ["email", "password"]), { done: true } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(f.oneOf(stepGithub, stepGoogle), []), { done: false, next: f.oneOf(stepGithub, stepGoogle) } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(f.oneOf(stepGithub, stepGoogle), ["oauth:google"]), { done: true });
	assertEquals(f.getNextAuthenticationStepAtPath(f.oneOf(stepGithub, stepGoogle), ["oauth:github"]), { done: true });
});
