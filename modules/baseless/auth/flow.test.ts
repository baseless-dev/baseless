import { assertEquals, assertThrows } from "https://deno.land/std@0.118.0/testing/asserts.ts";
import * as flow from "./flow.ts";

const otp = flow.otp({
	providerId: "email",
	providerLabel: {},
});
const email = flow.email();
const password = flow.password();
const passwordless = flow.chain(email, otp);
const email_and_password = flow.chain(email, password);
const google = flow.oauth({
	providerId: "google",
	providerLabel: {},
	providerIcon: ``,
	clientId: "",
	clientSecret: "",
	authorizationEndpoint: "",
	tokenEndpoint: "",
	openIdEndpoint: "",
	scope: [],
});
const github = flow.oauth({
	providerId: "github",
	providerLabel: {},
	providerIcon: ``,
	clientId: "",
	clientSecret: "",
	authorizationEndpoint: "",
	tokenEndpoint: "",
	openIdEndpoint: "",
	scope: [],
});
const oauth = flow.oneOf(google, github);
const nestedChain = flow.chain(
	flow.chain(email, password),
	google
);
const nestedOneOf = flow.oneOf(
	flow.oneOf(
		flow.oneOf(email),
		google,
	),
);
const nestedComplex = flow.chain(
	email,
	flow.oneOf(
		flow.chain(password, otp),
		flow.chain(google, otp),
	),
	github,
);
const realisticFlow = flow.oneOf(
	passwordless,
	email_and_password,
	oauth,
);

Deno.test("simplifyAuthStep", () => {
	assertEquals(flow.simplifyAuthStep(email), email);
	assertEquals(flow.simplifyAuthStep(password), password);
	assertEquals(flow.simplifyAuthStep(passwordless), passwordless);
	assertEquals(flow.simplifyAuthStep(nestedChain), flow.chain(email, password, google));
	assertEquals(flow.simplifyAuthStep(nestedOneOf), flow.oneOf(email, google));
	assertEquals(flow.simplifyAuthStep(nestedComplex), nestedComplex);
	assertEquals(flow.simplifyAuthStep(realisticFlow), flow.oneOf(
		flow.chain(email, otp),
		flow.chain(email, password),
		google,
		github
	));
});

Deno.test("visit", () => {
	const visitor: flow.Visitor<flow.AuthStepDefinition[]> = {
		enter(step, context) {
			if (step.type !== "chain" && step.type !== "oneOf") {
				context.push(step);
			}
			return flow.VisitorResult.Continue;
		}
	}
	const visit = (step: flow.AuthStepDefinition, context = [] as flow.AuthStepDefinition[]) => flow.visit(step, visitor, context);
	assertEquals(visit(email), [email]);
	assertEquals(visit(passwordless), [email, otp]);
	assertEquals(visit(nestedChain), [email, password, google]);
	assertEquals(visit(nestedOneOf), [email, google]);
	assertEquals(visit(nestedComplex), [email, password, otp, google, otp, github]);
});

Deno.test("replaceAuthStep", () => {
	const a = flow.email();
	const b = flow.password();
	const chain = flow.chain(a, b);
	const oneof = flow.oneOf(a, b);
	assertEquals(flow.replaceAuthStep(chain, a, b), flow.chain(b, b));
	assertEquals(flow.replaceAuthStep(chain, b, a), flow.chain(a, a));
	assertEquals(flow.replaceAuthStep(oneof, a, b), flow.oneOf(b, b));
	assertEquals(flow.replaceAuthStep(oneof, b, a), flow.oneOf(a, a));
});

Deno.test("decomposeAuthStep", () => {
	assertEquals(flow.decomposeAuthStep(email), email);
	assertEquals(flow.decomposeAuthStep(nestedChain), flow.chain(email, password, google));
	assertEquals(flow.decomposeAuthStep(nestedOneOf), flow.oneOf(email, google));
	assertEquals(flow.decomposeAuthStep(nestedComplex), flow.oneOf(flow.chain(email, password, otp, github), flow.chain(email, google, otp, github)));
});

Deno.test("nextAuthStep", () => {
	assertEquals(flow.nextAuthStep(email, []), { done: false, next: email });
	assertEquals(flow.nextAuthStep(password, []), { done: false, next: password });
	assertEquals(flow.nextAuthStep(email_and_password, []), { done: false, next: email });
	assertEquals(flow.nextAuthStep(email_and_password, ['email']), { done: false, next: password });
	assertEquals(flow.nextAuthStep(email_and_password, ['email', 'password']), { done: true });
	assertEquals(flow.nextAuthStep(oauth, []), { done: false, next: oauth });
	assertEquals(flow.nextAuthStep(oauth, ['oauth:google']), { done: true });
	assertEquals(flow.nextAuthStep(oauth, ['oauth:github']), { done: true });
	assertEquals(flow.nextAuthStep(realisticFlow, []), { done: false, next: flow.oneOf(email, google, github) });
	assertEquals(flow.nextAuthStep(realisticFlow, ['email']), { done: false, next: flow.oneOf(otp, password) });
	assertEquals(flow.nextAuthStep(realisticFlow, ['email', 'password']), { done: true });
	assertEquals(flow.nextAuthStep(realisticFlow, ['email', 'otp:email']), { done: true });
	assertEquals(flow.nextAuthStep(realisticFlow, ['oauth:google']), { done: true });
	assertEquals(flow.nextAuthStep(realisticFlow, ['oauth:github']), { done: true });
	assertThrows(() => flow.nextAuthStep(nestedChain, []));
	assertThrows(() => flow.nextAuthStep(nestedOneOf, []));
	assertThrows(() => flow.nextAuthStep(nestedComplex, []));
	assertEquals(flow.nextAuthStep(flow.decomposeAuthStep(nestedComplex), []), { done: false, next: email });
	assertEquals(flow.nextAuthStep(flow.decomposeAuthStep(nestedComplex), ['email']), { done: false, next: flow.oneOf(password, google) });
	assertEquals(flow.nextAuthStep(flow.decomposeAuthStep(nestedComplex), ['email', 'password']), { done: false, next: otp });
	assertEquals(flow.nextAuthStep(flow.decomposeAuthStep(nestedComplex), ['email', 'password', 'otp:email']), { done: false, next: github });
	assertEquals(flow.nextAuthStep(flow.decomposeAuthStep(nestedComplex), ['email', 'password', 'otp:email', 'oauth:github']), { done: true });
	assertEquals(flow.nextAuthStep(flow.decomposeAuthStep(nestedComplex), ['email', 'oauth:google']), { done: false, next: otp });
	assertEquals(flow.nextAuthStep(flow.decomposeAuthStep(nestedComplex), ['email', 'oauth:google', 'otp:email']), { done: false, next: github });
	assertEquals(flow.nextAuthStep(flow.decomposeAuthStep(nestedComplex), ['email', 'oauth:google', 'otp:email', 'oauth:github']), { done: true });
});