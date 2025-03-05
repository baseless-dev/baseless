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
		const email = await mock.post("/auth/submit-prompt", {
			data: { id: "email", value: "foo@test.local", state: begin.state },
			schema: AuthenticationResponse,
		});
		assert("state" in email);
		assert(!email.validating);
		assert(email.step.kind === "component");
		assert(email.step.id === "password");
		assert(email.step.prompt === "password");
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
	const password = new PasswordIdentityComponentProvider("dummy salt");
	using mock = await createMemoryServer({}, {
		algo: "PS512",
		privateKey: keyPair.privateKey,
		publicKey: keyPair.publicKey,
		ceremony: ({ flow }) =>
			flow === "authentication"
				? sequence(component("email"), component("password"), component("otp"))
				: sequence(component("email"), component("password")),
		components: { email, otp, password },
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
	const identityComponentOtp = {
		identityId: identity.id,
		componentId: "otp",
		confirmed: true,
		data: {
			channelId: "email",
		},
	} satisfies IdentityComponent;
	const identityComponentPassword = {
		identityId: identity.id,
		componentId: "password",
		confirmed: true,
		data: {
			hash: await password.hashPassword("lepassword"),
		},
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
		.set(`auth/identity/${identity.id}/component/${identityComponentOtp.componentId}`, identityComponentOtp)
		.set(`auth/identity/${identity.id}/component/${identityComponentPassword.componentId}`, identityComponentPassword)
		.set(`auth/identity/${identity.id}/channel/${identityChannelEmail.channelId}`, identityChannelEmail)
		// .set(`auth/identity-by-identification/email/${identityComponentEmail.identification}`, identityComponentEmail.identityId)
		.commit();

	await t.step("login", async () => {
		const begin = await mock.post("/auth/begin", { data: { kind: "authentication", scopes: [] }, schema: AuthenticationResponse });
		assert("state" in begin);
		assert(begin.step.kind === "component");
		assert(begin.step.id === "email");
		const email = await mock.post("/auth/submit-prompt", {
			data: { id: "email", value: "foo@test.local", state: begin.state },
			schema: AuthenticationResponse,
		});
		assert("state" in email);
		assert(email.step.kind === "component");
		assert(email.step.id === "password");
		const password = await mock.post("/auth/submit-prompt", {
			data: { id: "password", value: "lepassword", state: email.state },
			schema: AuthenticationResponse,
		});
		assert("state" in password);
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
		assert("accessToken" in otp);
	});
});
