import createMemoryServer from "../server.test.ts";
import { generateKeyPair } from "jose";
import { id } from "@baseless/core/id";
import * as Type from "@baseless/core/schema";
import { assert } from "@std/assert/assert";
import { Identity, IdentityChannel, IdentityComponent } from "@baseless/core/identity";
import { AuthenticationResponse } from "@baseless/core/authentication-response";
import { EmailIdentityComponentProvider } from "../auth/email.ts";
import { PasswordIdentityComponentProvider } from "../auth/password.ts";
import { component, sequence } from "@baseless/core/authentication-ceremony";
import { OtpComponentProvider } from "../auth/otp.ts";
import { Notification } from "@baseless/core/notification";
import { PolicyIdentityComponentProvider } from "../auth/policy.ts";
import { assertRejects } from "@std/assert/rejects";

Deno.test("Simple authentication", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const email = new EmailIdentityComponentProvider({
		sendValidationNotification({ code }): Notification {
			return {
				subject: "Your verification code",
				content: {
					"text/x-code": `${code}`,
				},
			};
		},
	});
	const password = new PasswordIdentityComponentProvider("dummy salt");
	using mock = await createMemoryServer({}, {
		algo: "PS512",
		privateKey: keyPair.privateKey,
		publicKey: keyPair.publicKey,
		secretKey: new TextEncoder().encode("2kkAiCQTWisiQOe0SdrppLTW9B8Uxe3n74Ij2BkN4tNrItFRelNt7QWe3kI2NiBs"),
		ceremony: sequence(component("email"), component("password")),
		components: { email, password },
		accessTokenTTL: 1000,
		refreshTokenTTL: 10_000,
	});

	const identity = {
		id: id("id_"),
		data: {
			firstName: "Foo",
			lastName: "Bar",
		},
	} satisfies Identity;
	const identityComponentEmail = {
		identityId: identity.id,
		componentId: "email",
		identification: "foo@test.local",
		confirmed: true,
		data: {},
	} satisfies IdentityComponent;
	const identityComponentPassword = {
		identityId: identity.id,
		componentId: "password",
		confirmed: true,
		data: {
			hash: await password.hashPassword("lepassword"),
		},
	} satisfies IdentityComponent;

	await mock.service.document.atomic()
		.set(`auth/identity/${identity.id}`, identity)
		.set(`auth/identity/${identity.id}/component/${identityComponentEmail.componentId}`, identityComponentEmail)
		.set(`auth/identity/${identity.id}/component/${identityComponentPassword.componentId}`, identityComponentPassword)
		.commit();

	await t.step("login", async () => {
		const begin = await mock.post("/auth/begin", {
			data: { kind: "authentication", scopes: ["firstName", "non-existing"] },
			schema: AuthenticationResponse,
		});
		assert("state" in begin);
		assert(!begin.validating);
		assert(begin.step.kind === "component");
		assert(begin.step.id === "email");
		assert(begin.step.prompt === "email");
		assert(!begin.step.sendable);
		await assertRejects(() =>
			mock.post("/auth/submit-prompt", {
				data: { id: "email", value: "bar@test.local", state: begin.state },
				schema: AuthenticationResponse,
			})
		);
		const email = await mock.post("/auth/submit-prompt", {
			data: { id: "email", value: "foo@test.local", state: begin.state },
			schema: AuthenticationResponse,
		});
		assert("state" in email);
		assert(!email.validating);
		assert(email.step.kind === "component");
		assert(email.step.id === "password");
		assert(email.step.prompt === "password");
		assert(!email.step.sendable);
		const password = await mock.post("/auth/submit-prompt", {
			data: { id: "password", value: "lepassword", state: email.state },
			schema: AuthenticationResponse,
		});
		assert("accessToken" in password);
		assert("idToken" in password);
	});

	await t.step("refresh token", async () => {
		const begin = await mock.post("/auth/begin", { data: { kind: "authentication", scopes: [] }, schema: AuthenticationResponse });
		assert("state" in begin);
		const email = await mock.post("/auth/submit-prompt", {
			data: { id: "email", value: "foo@test.local", state: begin.state },
			schema: AuthenticationResponse,
		});
		assert("state" in email);
		const password = await mock.post("/auth/submit-prompt", {
			data: { id: "password", value: "lepassword", state: email.state },
			schema: AuthenticationResponse,
		});
		assert("refreshToken" in password);
		await assertRejects(() => mock.post("/auth/refresh-token", { data: "foobar", schema: AuthenticationResponse }));
		const tokens = await mock.post("/auth/refresh-token", { data: password.refreshToken, schema: AuthenticationResponse });
		assert("accessToken" in tokens);
		assert(password.accessToken !== tokens.accessToken);
		assert(password.refreshToken !== tokens.refreshToken);
	});

	await t.step("sign-out", async () => {
		const begin = await mock.post("/auth/begin", { data: { kind: "authentication", scopes: [] }, schema: AuthenticationResponse });
		assert("state" in begin);
		const email = await mock.post("/auth/submit-prompt", {
			data: { id: "email", value: "foo@test.local", state: begin.state },
			schema: AuthenticationResponse,
		});
		assert("state" in email);
		const password = await mock.post("/auth/submit-prompt", {
			data: { id: "password", value: "lepassword", state: email.state },
			schema: AuthenticationResponse,
		});
		assert("accessToken" in password);
		const result = await mock.post("/auth/sign-out", {
			data: undefined,
			headers: { Authorization: `Bearer ${password.accessToken}` },
			schema: Type.Boolean(),
		});
		assert(result);
	});

	await t.step("register", async () => {
		const begin = await mock.post("/auth/begin", { data: { kind: "registration", scopes: [] }, schema: AuthenticationResponse });
		assert("state" in begin);
		assert(!begin.validating);
		assert(begin.step.kind === "component");
		assert(begin.step.id === "email");
		assert(begin.step.prompt === "email");
		const email = await mock.post("/auth/submit-prompt", {
			data: { id: "email", value: "bar@test.local", state: begin.state },
			schema: AuthenticationResponse,
		});
		assert("state" in email);
		assert(email.validating);
		assert(email.step.kind === "component");
		assert(email.step.id === "email");
		assert(email.step.prompt === "otp");
		const sendValidationCode = await mock.post("/auth/send-validation-code", {
			data: { id: "email", locale: "en", state: email.state },
			schema: Type.Boolean(),
		});
		assert(sendValidationCode);
		const code = mock.provider.notification.notifications[0].content["text/x-code"];
		assert(code);
		const submitValidationCode = await mock.post("/auth/submit-validation-code", {
			data: { id: "email", code, state: email.state },
			schema: AuthenticationResponse,
		});
		assert("state" in submitValidationCode);
		assert(!submitValidationCode.validating);
		assert(submitValidationCode.step.kind === "component");
		assert(submitValidationCode.step.id === "password");
		assert(submitValidationCode.step.prompt === "password");
		const password = await mock.post("/auth/submit-prompt", {
			data: { id: "password", value: "qwerty", state: submitValidationCode.state },
			schema: AuthenticationResponse,
		});
		assert("accessToken" in password);
	});
});

Deno.test("Two factor authentication", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const email = new EmailIdentityComponentProvider({
		sendValidationNotification({ code }): Notification {
			return {
				subject: "Your verification code",
				content: {
					"text/x-code": `${code}`,
				},
			};
		},
	});
	const password = new PasswordIdentityComponentProvider("dummy salt");
	const otp = new OtpComponentProvider({
		otp: { digits: 6 },
		signInNotification({ code }): Notification {
			return {
				subject: "Your verification code",
				content: {
					"text/x-code": `${code}`,
				},
			};
		},
	});
	const policy = new PolicyIdentityComponentProvider([
		{ identifier: "terms", version: "1.0", required: true, name: { en: "Terms of service" }, content: { en: "..." } },
	]);
	using mock = await createMemoryServer({}, {
		algo: "PS512",
		privateKey: keyPair.privateKey,
		publicKey: keyPair.publicKey,
		secretKey: new TextEncoder().encode("2kkAiCQTWisiQOe0SdrppLTW9B8Uxe3n74Ij2BkN4tNrItFRelNt7QWe3kI2NiBs"),
		ceremony: ({ flow }) =>
			flow === "authentication"
				? sequence(component("email"), component("password"), component("otp"), component("policy"))
				: sequence(component("policy"), component("email"), component("password")),
		components: { email, otp, password, policy },
		accessTokenTTL: 1000,
		refreshTokenTTL: 10_000,
	});

	const identity = {
		id: id("id_"),
		data: {},
	} satisfies Identity;
	const identityComponentEmail = {
		identityId: identity.id,
		componentId: "email",
		identification: "foo@test.local",
		confirmed: true,
		data: {},
	} satisfies IdentityComponent;
	const identityComponentPassword = {
		identityId: identity.id,
		componentId: "password",
		confirmed: true,
		data: {
			hash: await password.hashPassword("lepassword"),
		},
	} satisfies IdentityComponent;
	const identityComponentOtp = {
		identityId: identity.id,
		componentId: "otp",
		confirmed: true,
		data: {
			channelId: "email",
		},
	} satisfies IdentityComponent;
	const identityComponentPolicy = {
		identityId: identity.id,
		componentId: "policy",
		confirmed: true,
		data: {},
	} satisfies IdentityComponent;
	const identityChannelEmail = {
		identityId: identity.id,
		channelId: "email",
		confirmed: true,
		data: { email: identityComponentEmail.identification! },
	} satisfies IdentityChannel;

	await mock.service.document.atomic()
		.set(`auth/identity/${identity.id}`, identity)
		.set(`auth/identity/${identity.id}/component/${identityComponentEmail.componentId}`, identityComponentEmail)
		.set(`auth/identity/${identity.id}/component/${identityComponentPassword.componentId}`, identityComponentPassword)
		.set(`auth/identity/${identity.id}/component/${identityComponentOtp.componentId}`, identityComponentOtp)
		.set(`auth/identity/${identity.id}/component/${identityComponentPolicy.componentId}`, identityComponentPolicy)
		.set(`auth/identity/${identity.id}/channel/${identityChannelEmail.channelId}`, identityChannelEmail)
		.commit();

	await t.step("login", async () => {
		const begin = await mock.post("/auth/begin", { data: { kind: "authentication", scopes: [] }, schema: AuthenticationResponse });
		assert("state" in begin);
		assert(begin.step.kind === "component");
		assert(begin.step.id === "email");
		assert(!begin.step.sendable);
		const email = await mock.post("/auth/submit-prompt", {
			data: { id: "email", value: "foo@test.local", state: begin.state },
			schema: AuthenticationResponse,
		});
		assert("state" in email);
		assert(email.step.kind === "component");
		assert(email.step.id === "password");
		assert(!email.step.sendable);
		const password = await mock.post("/auth/submit-prompt", {
			data: { id: "password", value: "lepassword", state: email.state },
			schema: AuthenticationResponse,
		});
		assert("state" in password);
		assert(password.step.kind === "component");
		assert(password.step.id === "otp");
		assert(password.step.sendable);
		const sendPrompt = await mock.post("/auth/send-prompt", {
			data: { id: "otp", locale: "en", state: password.state },
			schema: Type.Boolean(),
		});
		assert(sendPrompt);
		const code = mock.provider.notification.notifications[0].content["text/x-code"];
		assert(code);
		const otp = await mock.post("/auth/submit-prompt", {
			data: { id: "otp", value: code, state: password.state },
			schema: AuthenticationResponse,
		});
		assert("state" in otp);
		assert(!otp.validating);
		assert(otp.step.kind === "component");
		assert(otp.step.id === "policy");
		assert(!otp.step.sendable);
		const policy = await mock.post("/auth/submit-prompt", {
			data: { id: "policy", value: { terms: "1.0" }, state: otp.state },
			schema: AuthenticationResponse,
		});
		assert("accessToken" in policy);

		const sendPrompt2 = await mock.post("/auth/send-prompt", {
			data: { id: "otp", locale: "en", state: password.state },
			schema: Type.Boolean(),
		});
		assert(sendPrompt2);
		const code2 = mock.provider.notification.notifications[1].content["text/x-code"];
		assert(code2);
		const otp2 = await mock.post("/auth/submit-prompt", {
			data: { id: "otp", value: code2, state: password.state },
			schema: AuthenticationResponse,
		});
		assert("accessToken" in otp2);
	});
});
