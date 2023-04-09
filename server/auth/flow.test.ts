// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertThrows } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as f from "./flow.ts";

const email = new f.AuthenticationIdentificationEmail({ icon: "", label: {} });
const password = new f.AuthenticationChallengePassword({ icon: "", label: {} });
const otp = new f.AuthenticationChallengeOTPLogger({ icon: "", label: {} });
const github = new f.AuthenticationIdentificationOAuth({
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
const google = new f.AuthenticationIdentificationOAuth({
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
	assertEquals(f.simplify(email), email);
	assertEquals(f.simplify(password), password);
	assertEquals(f.simplify(f.sequence(email, password)), f.sequence(email, password));
	assertEquals(f.simplify(f.sequence(email, f.sequence(password, otp))), f.sequence(email, password, otp));
	assertEquals(f.simplify(f.oneOf(email, github)), f.oneOf(email, github));
	assertEquals(f.simplify(f.oneOf(email, f.oneOf(google, github))), f.oneOf(email, google, github));
	assertEquals(
		f.simplify(f.oneOf(f.sequence(email, password), f.sequence(email, otp), f.oneOf(google, github))),
		f.oneOf(f.sequence(email, password), f.sequence(email, otp), google, github),
	);
});

Deno.test("replace step", () => {
	assertEquals(f.replace(f.sequence(email, password), email, password), f.sequence(password, password));
	assertEquals(f.replace(f.oneOf(email, password), email, password), f.oneOf(password, password));
});

Deno.test("flatten step", () => {
	assertEquals(
		f.flatten(f.oneOf(f.sequence(email, password), f.sequence(email, otp), f.oneOf(google, github))),
		f.oneOf(f.sequence(email, password), f.sequence(email, otp), google, github),
	);
	assertEquals(
		f.flatten(f.sequence(f.oneOf(email, github, google), otp)),
		f.oneOf(f.sequence(email, otp), f.sequence(github, otp), f.sequence(google, otp)),
	);
});

Deno.test("getNextIdentificationOrChallenge", () => {
	assertEquals(f.getNextIdentificationOrChallenge(email).next(), { done: false, value: email });
	{
		const iter = f.getNextIdentificationOrChallenge(email);
		assertEquals(iter.next(), { done: false, value: email });
		assertEquals(iter.next(), { done: true, value: undefined });
	}
	{
		const iter = f.getNextIdentificationOrChallenge(f.sequence(email, password));
		assertEquals(iter.next(), { done: false, value: email });
		assertEquals(iter.next(), { done: true, value: undefined });
	}
	{
		const iter = f.getNextIdentificationOrChallenge(f.oneOf(google, github));
		assertEquals(iter.next(), { done: false, value: google });
		assertEquals(iter.next(), { done: false, value: github });
		assertEquals(iter.next(), { done: true, value: undefined });
	}
});

Deno.test("getNextAuthenticationStepAtPath", () => {
	assertEquals(f.getNextAuthenticationStepAtPath(email, []), { done: false, next: email } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(password, []), { done: false, next: password } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(f.sequence(email, password), []), { done: false, next: email } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(f.sequence(email, password), ["email"]), { done: false, next: password } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(f.sequence(email, password), ["email", "password"]), { done: true } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(f.oneOf(github, google), []), { done: false, next: f.oneOf(github, google) } as any);
	assertEquals(f.getNextAuthenticationStepAtPath(f.oneOf(github, google), ["oauth:google"]), { done: true });
	assertEquals(f.getNextAuthenticationStepAtPath(f.oneOf(github, google), ["oauth:github"]), { done: true });
});
