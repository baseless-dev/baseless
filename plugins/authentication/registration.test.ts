import {
	assert,
	assertEquals,
	assertObjectMatch,
	assertRejects,
} from "https://deno.land/std@0.213.0/assert/mod.ts";
import { generateKeyPair } from "npm:jose@5.2.0";
import { oneOf, sequence } from "../../lib/authentication/types.ts";
import { ruid } from "../../lib/autoid.ts";
import EmailAuthentificationComponent from "../../providers/auth/email/mod.ts";
import OTPMemoryAuthentificationComponent from "../../providers/auth/otp-memory/mod.ts";
import PasswordAuthentificationComponent from "../../providers/auth/password/mod.ts";
import { MemoryDocumentProvider } from "../../providers/document/memory/mod.ts";
import { DocumentIdentityProvider } from "../../providers/identity/document/mod.ts";
import { MemoryKVProvider } from "../../providers/kv/memory/mod.ts";
import { MemoryNotificationProvider } from "../../providers/notification/memory/mod.ts";
import RegistrationService from "./registration.ts";

Deno.test("RegistrationService", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const init = async () => {
		const notificationProvider = new MemoryNotificationProvider();
		const kvProvider = new MemoryKVProvider();
		const identityProvider = new DocumentIdentityProvider(
			new MemoryDocumentProvider(),
		);
		const keys = {
			algo: "PS512",
			...keyPair,
		};
		const emailProvider = new EmailAuthentificationComponent(
			"email",
			identityProvider,
			kvProvider,
			notificationProvider,
		);
		const passwordProvider = new PasswordAuthentificationComponent(
			"password",
			"lesalt",
		);
		const otpProvider = new OTPMemoryAuthentificationComponent(
			"otp",
			{
				digits: 6,
			},
		);
		const ceremony = sequence(
			emailProvider.toCeremonyComponent(),
			oneOf(
				passwordProvider.toCeremonyComponent(),
				otpProvider.toCeremonyComponent(),
			),
		);
		const register = new RegistrationService(
			[
				emailProvider,
				passwordProvider,
				otpProvider,
			],
			ceremony,
			identityProvider,
			keys,
		);
		const john = await identityProvider.create({}, [
			{
				id: "email",
				...await emailProvider.configureIdentityComponent("john@test.local"),
				confirmed: true,
			},
			{
				id: "password",
				...await passwordProvider.configureIdentityComponent("123"),
			},
			{
				id: "otp",
				...await otpProvider.configureIdentityComponent(null),
			},
		]);
		return {
			register,
			notificationProvider,
			emailProvider,
			passwordProvider,
			otpProvider,
			john,
		};
	};

	await t.step("get ceremony", async () => {
		const { register, emailProvider, passwordProvider } = await init();
		assertObjectMatch(
			await register.getCeremony(),
			{
				done: false,
				first: true,
				last: false,
				component: { kind: "prompt", id: "email" },
			},
		);
		assertObjectMatch(
			await register.getCeremony({
				kind: "registration",
				identity: ruid("rid-"),
				components: [{
					id: "email",
					...await emailProvider.configureIdentityComponent("jane@test.local"),
				}],
			}),
			{
				done: false,
				first: false,
				last: false,
				component: { kind: "prompt", id: "email" },
			},
		);
		assertObjectMatch(
			await register.getCeremony({
				kind: "registration",
				identity: ruid("rid-"),
				components: [{
					id: "email",
					...await emailProvider.configureIdentityComponent("jane@test.local"),
					confirmed: true,
				}],
			}),
			{
				done: false,
				first: false,
				last: false,
				component: {
					kind: "prompt",
					id: "password",
				},
			},
		);
		assertObjectMatch(
			await register.getCeremony({
				kind: "registration",
				identity: ruid("rid-"),
				components: [{
					id: "email",
					...await emailProvider.configureIdentityComponent("jane@test.local"),
					confirmed: true,
				}, {
					id: "password",
					...await passwordProvider.configureIdentityComponent("123"),
				}],
			}),
			{
				done: true,
			},
		);
	});

	await t.step("submit prompt", async () => {
		const { register, emailProvider } = await init();

		const state1 = await register.submitPrompt("email", "jane@test.local");
		assertObjectMatch(
			state1,
			{
				kind: "registration",
				components: [
					{
						id: "email",
						...await emailProvider.configureIdentityComponent(
							"jane@test.local",
						),
					},
				],
			},
		);
		assert(state1.kind === "registration");
		await assertRejects(() => register.submitPrompt("password", "123", state1));
	});

	await t.step("send validation code", async () => {
		const { register, notificationProvider } = await init();

		const state1 = await register.submitPrompt("email", "jane@test.local");
		assert(state1.kind === "registration");
		assertEquals(
			await register.sendValidationCode("email", "en", state1),
			true,
		);
		assert(
			notificationProvider.notifications.at(-1)?.content["text/x-otp-code"],
		);
	});

	await t.step("submit validation code", async () => {
		const { register, notificationProvider, emailProvider } = await init();

		const state1 = await register.submitPrompt("email", "jane@test.local");
		assert(state1.kind === "registration");
		await register.sendValidationCode("email", "en", state1);
		const code =
			notificationProvider.notifications.at(-1)!.content["text/x-otp-code"];
		assertObjectMatch(
			await register.submitValidationCode("email", code, state1),
			{
				components: [
					{
						id: "email",
						...await emailProvider.configureIdentityComponent(
							"jane@test.local",
						),
						confirmed: true,
					},
				],
			},
		);
	});

	await t.step("submit last prompt returns an identity", async () => {
		const { register, notificationProvider } = await init();

		const state1 = await register.submitPrompt("email", "jane@test.local");
		assert(state1.kind === "registration");
		await register.sendValidationCode("email", "en", state1);
		const code =
			notificationProvider.notifications.at(-1)!.content["text/x-otp-code"];
		const state2 = await register.submitValidationCode("email", code, state1);
		assert(state2.kind === "registration");
		const state3 = await register.submitPrompt("password", "123", state2);
		assert(state3.kind === "identity");
	});
});
