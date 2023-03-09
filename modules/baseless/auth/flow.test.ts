import { assertEquals } from "https://deno.land/std@0.118.0/testing/asserts.ts";
import * as flow from "./flow.ts";

const otp = flow.otp({
	providerId: "email",
	providerLabel: "One time password by email",
});
const email = flow.email();
const password = flow.password();
const passwordless = flow.chain(email, otp);
const email_and_password = flow.chain(email, password);
const google = flow.oauth({
	providerId: "google",
	providerLabel: "Github",
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
	providerLabel: "Github",
	providerIcon: ``,
	clientId: "",
	clientSecret: "",
	authorizationEndpoint: "",
	tokenEndpoint: "",
	openIdEndpoint: "",
	scope: [],
});
const oauth = flow.oneOf(google, github);
const authFlow = flow.oneOf(
	passwordless,
	email_and_password,
	oauth,
);

Deno.test("blep", () => {
	const stupidFlow = flow.oneOf(
		flow.oneOf(
			flow.oneOf(
				flow.chain(email, password),
				flow.chain(email, otp),
			),
			flow.chain(email, otp),
			google,
		),
	);
	// assertEquals(flow.nextStepAtPath(stupidFlow), { done: false, value: flow.oneOf(email, google) });
	// assertEquals(flow.nextStepAtPath(stupidFlow, ['email']), { done: false, value: flow.oneOf(password, otp) });
	// assertEquals(flow.nextStepAtPath(passwordless), { done: false, value: email });
	// assertEquals(flow.nextStepAtPath(passwordless, ["email"]), { done: false, value: otp });
	// assertEquals(flow.nextStepAtPath(passwordless, ["email", "otp:email"]), { done: true, value: undefined });
	// assertEquals(flow.nextStepAtPath(oauth, ["oauth:google"]), { done: true, value: undefined });

	assertEquals(flow.nextStepAtPath(authFlow), { done: false, value: flow.oneOf(email, google, github) });
	assertEquals(flow.nextStepAtPath(authFlow, ["email"]), { done: false, value: flow.oneOf(otp, password) });
	assertEquals(flow.nextStepAtPath(authFlow, ["email", "otp:email"]), { done: true, value: undefined });
	assertEquals(flow.nextStepAtPath(authFlow, ["email", "password"]), { done: true, value: undefined });
	assertEquals(flow.nextStepAtPath(authFlow, ["oauth:google"]), { done: true, value: undefined });
	assertEquals(flow.nextStepAtPath(authFlow, ["oauth:github"]), { done: true, value: undefined });
});
