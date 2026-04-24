import createMemoryServer from "../server.test.ts";
import { app } from "../app.ts";
import authApp from "./authentication.ts";
import { generateKeyPair } from "jose";
import { ksuid } from "@baseless/core/id";
import * as z from "@baseless/core/schema";
import { assert } from "@std/assert/assert";
import { assertEquals } from "@std/assert/equals";
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
	using mock = await createMemoryServer({
		app: app()
			.extend(authApp)
			.build(),
		configuration: {
			auth: {
				accessTokenTTL: 5 * 60 * 1_000,
				authenticationTTL: 5 * 60 * 1_000,
				ceremony: sequence(component("email"), component("password")),
				components: { email, password },
				keyAlgo: "PS512",
				keyPrivate: keyPair.privateKey,
				keyPublic: keyPair.publicKey,
				keySecret: new TextEncoder().encode("2kkAiCQTWisiQOe0SdrppLTW9B8Uxe3n74Ij2BkN4tNrItFRelNt7QWe3kI2NiBs"),
				rateLimit: { limit: 5, period: 5 * 60 * 1_000 },
				refreshTokenTTL: 10 * 60 * 1_000,
			},
		},
	});

	const identity = {
		id: ksuid("id_"),
		data: {
			firstName: "Foo",
			lastName: "Bar",
		},
	} satisfies Identity;
	const modifiableIdentity = {
		id: ksuid("id_"),
		data: {
			firstName: "Baz",
			lastName: "Qux",
		},
	} satisfies Identity;
	const passwordOnlyIdentity = {
		id: ksuid("id_"),
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
	const modifiableIdentityComponentEmail = {
		identityId: modifiableIdentity.id,
		componentId: "email",
		identification: "modify@test.local",
		confirmed: true,
		data: {},
	} satisfies IdentityComponent;
	const modifiableIdentityComponentPassword = {
		identityId: modifiableIdentity.id,
		componentId: "password",
		confirmed: true,
		data: {
			hash: await password.hashPassword("old-password"),
		},
	} satisfies IdentityComponent;
	const passwordOnlyIdentityComponentPassword = {
		identityId: passwordOnlyIdentity.id,
		componentId: "password",
		confirmed: true,
		data: {
			hash: await password.hashPassword("only-password"),
		},
	} satisfies IdentityComponent;

	await mock.service.document.atomic()
		.set("auth/identity/:key" as never, { key: identity.id } as never, identity as never)
		.set(
			"auth/identity/:id/component/:component" as never,
			{ id: identity.id, component: identityComponentEmail.componentId } as never,
			identityComponentEmail as never,
		)
		.set(
			"auth/identity/:id/component/:component" as never,
			{ id: identity.id, component: identityComponentPassword.componentId } as never,
			identityComponentPassword as never,
		)
		.set("auth/identity/:key" as never, { key: modifiableIdentity.id } as never, modifiableIdentity as never)
		.set(
			"auth/identity/:id/component/:component" as never,
			{ id: modifiableIdentity.id, component: modifiableIdentityComponentEmail.componentId } as never,
			modifiableIdentityComponentEmail as never,
		)
		.set(
			"auth/identity/:id/component/:component" as never,
			{ id: modifiableIdentity.id, component: modifiableIdentityComponentPassword.componentId } as never,
			modifiableIdentityComponentPassword as never,
		)
		.set("auth/identity/:key" as never, { key: passwordOnlyIdentity.id } as never, passwordOnlyIdentity as never)
		.set(
			"auth/identity/:id/component/:component" as never,
			{ id: passwordOnlyIdentity.id, component: passwordOnlyIdentityComponentPassword.componentId } as never,
			passwordOnlyIdentityComponentPassword as never,
		)
		.commit();

	async function getComponent(identityId: Identity["id"], componentId: string): Promise<IdentityComponent | undefined> {
		return await mock.service.document
			.get("auth/identity/:id/component/:key" as never, { id: identityId, key: componentId } as never)
			.then((document) => document.data as IdentityComponent)
			.catch((_) => undefined);
	}

	async function getChannel(identityId: Identity["id"], channelId: string): Promise<IdentityChannel | undefined> {
		return await mock.service.document
			.get("auth/identity/:id/channel/:key" as never, { id: identityId, key: channelId } as never)
			.then((document) => document.data as IdentityChannel)
			.catch((_) => undefined);
	}

	async function createAccessToken(identity: Identity): Promise<string> {
		const tokens = await mock.service.auth.createSession(identity, Date.now() / 1000 >> 0, []);
		return tokens.accessToken;
	}

	await t.step("login", async () => {
		const { result: begin } = await mock.fetch("/auth/begin", {
			data: { kind: "authentication", scopes: ["firstName", "non-existing"] },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in begin);
		assert(!begin.validating);
		assert(begin.step.kind === "component");
		assert(begin.step.id === "email");
		assert(begin.step.prompt === "email");
		assert(!begin.step.sendable);
		await assertRejects(() =>
			mock.fetch("/auth/submit-prompt", {
				data: { id: "email", value: "bar@test.local", state: begin.state },
				schema: z.object({ result: AuthenticationResponse }),
			})
		);
		const { result: email } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "email", value: "foo@test.local", state: begin.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in email);
		assert(!email.validating);
		assert(email.step.kind === "component");
		assert(email.step.id === "password");
		assert(email.step.prompt === "password");
		assert(!email.step.sendable);
		const { result: password } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "password", value: "lepassword", state: email.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("accessToken" in password);
		assert("idToken" in password);
	});

	await t.step("refresh token", async () => {
		const { result: begin } = await mock.fetch("/auth/begin", {
			data: { kind: "authentication", scopes: [] },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in begin);
		const { result: email } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "email", value: "foo@test.local", state: begin.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in email);
		const { result: password } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "password", value: "lepassword", state: email.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("refreshToken" in password);
		await assertRejects(() => mock.fetch("/auth/refresh-token", { data: "foobar", schema: z.object({ result: AuthenticationResponse }) }));
		const { result: tokens } = await mock.fetch("/auth/refresh-token", {
			data: { token: password.refreshToken },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("accessToken" in tokens);
		assert(password.accessToken !== tokens.accessToken);
		assert(password.refreshToken !== tokens.refreshToken);
	});

	await t.step("sign-out", async () => {
		const { result: begin } = await mock.fetch("/auth/begin", {
			data: { kind: "authentication", scopes: [] },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in begin);
		const { result: email } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "email", value: "foo@test.local", state: begin.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in email);
		const { result: password } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "password", value: "lepassword", state: email.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("accessToken" in password);
		const { result } = await mock.fetch("/auth/sign-out", {
			data: undefined,
			headers: { Authorization: `Bearer ${password.accessToken}` },
			schema: z.object({ result: z.boolean() }),
		});
		assert(result);
	});

	await t.step("register", async () => {
		const { result: begin } = await mock.fetch("/auth/begin", {
			data: { kind: "registration", scopes: [] },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in begin);
		assert(!begin.validating);
		assert(begin.step.kind === "component");
		assert(begin.step.id === "email");
		assert(begin.step.prompt === "email");
		const { result: email } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "email", value: "bar@test.local", state: begin.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in email);
		assert(email.validating);
		assert(email.step.kind === "component");
		assert(email.step.id === "email");
		assert(email.step.prompt === "otp");
		const sendValidationCode = await mock.fetch("/auth/send-validation-code", {
			data: { id: "email", locale: "en", state: email.state },
			schema: z.object({ result: z.boolean() }),
		});
		assert(sendValidationCode);
		const code = mock.provider.notification.notifications[0].content["text/x-code"];
		assert(code);
		const { result: submitValidationCode } = await mock.fetch("/auth/submit-validation-code", {
			data: { id: "email", code, state: email.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in submitValidationCode);
		assert(!submitValidationCode.validating);
		assert(submitValidationCode.step.kind === "component");
		assert(submitValidationCode.step.id === "password");
		assert(submitValidationCode.step.prompt === "password");
		const { result: password } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "password", value: "qwerty", state: submitValidationCode.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("accessToken" in password);
	});

	await t.step("modification requires authentication", async () => {
		await assertRejects(() =>
			mock.fetch("/auth/begin", {
				data: { kind: "modification", componentId: "password", scopes: [] },
				schema: z.object({ result: AuthenticationResponse }),
			})
		);
	});

	await t.step("modify password", async () => {
		const accessToken = await createAccessToken(modifiableIdentity);
		const { result: begin } = await mock.fetch("/auth/begin", {
			data: { kind: "modification", componentId: "password", scopes: [] },
			headers: { Authorization: `Bearer ${accessToken}` },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in begin);
		assert(begin.step.kind === "component");
		assertEquals(begin.step.id, "password");

		const { result: verify } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "password", value: "old-password", state: begin.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in verify);
		assert(verify.step.kind === "component");
		assertEquals(verify.step.id, "password");
		assertEquals(
			(await getComponent(modifiableIdentity.id, "password"))?.data.hash,
			modifiableIdentityComponentPassword.data.hash,
		);

		const { result: complete } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "password", value: "new-password", state: verify.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("kind" in complete);
		assertEquals(complete.kind, "modification-complete");
		assertEquals(complete.componentId, "password");
		assertEquals(
			(await getComponent(modifiableIdentity.id, "password"))?.data.hash,
			await password.hashPassword("new-password"),
		);
	});

	await t.step("modify email", async () => {
		const accessToken = await createAccessToken(modifiableIdentity);
		const { result: begin } = await mock.fetch("/auth/begin", {
			data: { kind: "modification", componentId: "email", scopes: [] },
			headers: { Authorization: `Bearer ${accessToken}` },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in begin);
		assert(begin.step.kind === "component");
		assertEquals(begin.step.id, "email");

		const { result: verifyOldEmail } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "email", value: "modify@test.local", state: begin.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in verifyOldEmail);
		assert(verifyOldEmail.validating);
		assert(verifyOldEmail.step.kind === "component");
		assertEquals(verifyOldEmail.step.prompt, "otp");
		assertEquals((await getComponent(modifiableIdentity.id, "email"))?.identification, "modify@test.local");

		const { result: sendOldCode } = await mock.fetch("/auth/send-validation-code", {
			data: { id: "email", locale: "en", state: verifyOldEmail.state },
			schema: z.object({ result: z.boolean() }),
		});
		assert(sendOldCode);
		const oldCode = mock.provider.notification.notifications[1].content["text/x-code"];
		assert(oldCode);

		const { result: setupNewEmail } = await mock.fetch("/auth/submit-validation-code", {
			data: { id: "email", code: oldCode, state: verifyOldEmail.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in setupNewEmail);
		assert(!setupNewEmail.validating);
		assert(setupNewEmail.step.kind === "component");
		assertEquals(setupNewEmail.step.prompt, "email");

		const { result: verifyNewEmail } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "email", value: "modified@test.local", state: setupNewEmail.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in verifyNewEmail);
		assert(verifyNewEmail.validating);
		assertEquals((await getComponent(modifiableIdentity.id, "email"))?.identification, "modify@test.local");

		const { result: sendNewCode } = await mock.fetch("/auth/send-validation-code", {
			data: { id: "email", locale: "en", state: verifyNewEmail.state },
			schema: z.object({ result: z.boolean() }),
		});
		assert(sendNewCode);
		const newCode = mock.provider.notification.notifications[2].content["text/x-code"];
		assert(newCode);

		const { result: complete } = await mock.fetch("/auth/submit-validation-code", {
			data: { id: "email", code: newCode, state: verifyNewEmail.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("kind" in complete);
		assertEquals(complete.kind, "modification-complete");
		assertEquals((await getComponent(modifiableIdentity.id, "email"))?.identification, "modified@test.local");
		assertEquals((await getChannel(modifiableIdentity.id, "email"))?.data.email, "modified@test.local");
		const oldIndex = await mock.service.document
			.get(
				"auth/identity-by-identification/:component/:identification" as never,
				{ component: "email", identification: "modify@test.local" } as never,
			)
			.catch((_) => undefined);
		assertEquals(oldIndex, undefined);
		const newIndex = await mock.service.document.get(
			"auth/identity-by-identification/:component/:identification" as never,
			{ component: "email", identification: "modified@test.local" } as never,
		);
		assertEquals(newIndex.data, modifiableIdentity.id);
	});

	await t.step("add missing email", async () => {
		const accessToken = await createAccessToken(passwordOnlyIdentity);
		const { result: begin } = await mock.fetch("/auth/begin", {
			data: { kind: "modification", componentId: "email", scopes: [] },
			headers: { Authorization: `Bearer ${accessToken}` },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in begin);
		assert(begin.step.kind === "component");
		assertEquals(begin.step.prompt, "email");

		const { result: verifyNewEmail } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "email", value: "new@test.local", state: begin.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in verifyNewEmail);
		assert(verifyNewEmail.validating);
		assertEquals(await getComponent(passwordOnlyIdentity.id, "email"), undefined);

		const { result: sendCode } = await mock.fetch("/auth/send-validation-code", {
			data: { id: "email", locale: "en", state: verifyNewEmail.state },
			schema: z.object({ result: z.boolean() }),
		});
		assert(sendCode);
		const code = mock.provider.notification.notifications[3].content["text/x-code"];
		assert(code);

		const { result: complete } = await mock.fetch("/auth/submit-validation-code", {
			data: { id: "email", code, state: verifyNewEmail.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("kind" in complete);
		assertEquals(complete.kind, "modification-complete");
		assertEquals((await getComponent(passwordOnlyIdentity.id, "email"))?.identification, "new@test.local");
		assertEquals((await getChannel(passwordOnlyIdentity.id, "email"))?.data.email, "new@test.local");
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
	using mock = await createMemoryServer({
		app: app()
			.extend(authApp)
			.build(),
		configuration: {
			auth: {
				accessTokenTTL: 5 * 60 * 1_000,
				authenticationTTL: 5 * 60 * 1_000,
				ceremony: ({ flow }) =>
					flow === "authentication"
						? sequence(component("email"), component("password"), component("otp"), component("policy"))
						: sequence(component("policy"), component("email"), component("password")),
				components: { email, otp, password, policy },
				keyAlgo: "PS512",
				keyPrivate: keyPair.privateKey,
				keyPublic: keyPair.publicKey,
				keySecret: new TextEncoder().encode("2kkAiCQTWisiQOe0SdrppLTW9B8Uxe3n74Ij2BkN4tNrItFRelNt7QWe3kI2NiBs"),
				rateLimit: { limit: 5, period: 5 * 60 * 1_000 },
				refreshTokenTTL: 10 * 60 * 1_000,
			},
		},
	});

	const identity = {
		id: ksuid("id_"),
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
		.set("auth/identity/:key" as never, { key: identity.id } as never, identity as never)
		.set(
			"auth/identity/:id/component/:component" as never,
			{ id: identity.id, component: identityComponentEmail.componentId } as never,
			identityComponentEmail as never,
		)
		.set(
			"auth/identity/:id/component/:component" as never,
			{ id: identity.id, component: identityComponentPassword.componentId } as never,
			identityComponentPassword as never,
		)
		.set(
			"auth/identity/:id/component/:component" as never,
			{ id: identity.id, component: identityComponentOtp.componentId } as never,
			identityComponentOtp as never,
		)
		.set(
			"auth/identity/:id/component/:component" as never,
			{ id: identity.id, component: identityComponentPolicy.componentId } as never,
			identityComponentPolicy as never,
		)
		.set(
			"auth/identity/:id/channel/:channel" as never,
			{ id: identity.id, channel: identityChannelEmail.channelId } as never,
			identityChannelEmail as never,
		)
		.commit();

	await t.step("login", async () => {
		const { result: begin } = await mock.fetch("/auth/begin", {
			data: { kind: "authentication", scopes: [] },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in begin);
		assert(begin.step.kind === "component");
		assert(begin.step.id === "email");
		assert(!begin.step.sendable);
		const { result: email } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "email", value: "foo@test.local", state: begin.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in email);
		assert(email.step.kind === "component");
		assert(email.step.id === "password");
		assert(!email.step.sendable);
		const { result: password } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "password", value: "lepassword", state: email.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in password);
		assert(password.step.kind === "component");
		assert(password.step.id === "otp");
		assert(password.step.sendable);
		const { result: sendPrompt } = await mock.fetch("/auth/send-prompt", {
			data: { id: "otp", locale: "en", state: password.state },
			schema: z.object({ result: z.boolean() }),
		});
		assert(sendPrompt);
		const code = mock.provider.notification.notifications[0].content["text/x-code"];
		assert(code);
		const { result: otp } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "otp", value: code, state: password.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("state" in otp);
		assert(!otp.validating);
		assert(otp.step.kind === "component");
		assert(otp.step.id === "policy");
		assert(!otp.step.sendable);
		const { result: policy } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "policy", value: { terms: "1.0" }, state: otp.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("accessToken" in policy);

		const { result: sendPrompt2 } = await mock.fetch("/auth/send-prompt", {
			data: { id: "otp", locale: "en", state: password.state },
			schema: z.object({ result: z.boolean() }),
		});
		assert(sendPrompt2);
		const code2 = mock.provider.notification.notifications[1].content["text/x-code"];
		assert(code2);
		const { result: otp2 } = await mock.fetch("/auth/submit-prompt", {
			data: { id: "otp", value: code2, state: password.state },
			schema: z.object({ result: AuthenticationResponse }),
		});
		assert("accessToken" in otp2);
	});
});
