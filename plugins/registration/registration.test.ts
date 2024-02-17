import {
	assert,
	assertEquals,
	assertObjectMatch,
	assertRejects,
} from "../../deps.test.ts";
import { generateKeyPair } from "../../deps.ts";
import { oneOf, sequence } from "../../lib/authentication/types.ts";
import { autoid } from "../../lib/autoid.ts";
import EmailAuthentificationComponent from "../../providers/auth-email/mod.ts";
import OTPMessageAuthentificationComponent from "../../providers/auth-otp-message/mod.ts";
import PasswordAuthentificationComponent from "../../providers/auth-password/mod.ts";
import { MemoryDocumentProvider } from "../../providers/document-memory/mod.ts";
import { DocumentIdentityProvider } from "../../providers/identity-document/mod.ts";
import { MemoryKVProvider } from "../../providers/kv-memory/mod.ts";
import { MemoryMessageProvider } from "../../providers/message-memory/mod.ts";
import RegistrationService from "./registration.ts";

Deno.test("RegistrationService", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const init = async () => {
		const message = new MemoryMessageProvider();
		const kv = new MemoryKVProvider();
		const identity = new DocumentIdentityProvider(
			new MemoryDocumentProvider(),
		);
		const keys = {
			algo: "PS512",
			...keyPair,
		};
		const emailProvider = new EmailAuthentificationComponent(
			"email",
			identity,
			kv,
			message,
		);
		const passwordProvider = new PasswordAuthentificationComponent(
			"password",
			"lesalt",
		);
		const otpProvider = new OTPMessageAuthentificationComponent(
			"otp",
			{
				digits: 6,
			},
			kv,
			message,
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
			identity,
			keys,
		);
		const john = await identity.create({}, [
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
			message,
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
				identity: autoid("rid-"),
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
				identity: autoid("rid-"),
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
					kind: "choice",
					components: [{ id: "password" }, { id: "otp" }],
				},
			},
		);
		assertObjectMatch(
			await register.getCeremony({
				kind: "registration",
				identity: autoid("rid-"),
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
		const { register, message } = await init();

		const state1 = await register.submitPrompt("email", "jane@test.local");
		assert(state1.kind === "registration");
		assertEquals(
			await register.sendValidationCode("email", "en", state1),
			true,
		);
		assert(message.messages.at(-1));
	});

	await t.step("submit validation code", async () => {
		const { register, message, emailProvider } = await init();

		const state1 = await register.submitPrompt("email", "jane@test.local");
		assert(state1.kind === "registration");
		await register.sendValidationCode("email", "en", state1);
		const code = message.messages.at(-1)!.text;
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
		const { register, message } = await init();

		const state1 = await register.submitPrompt("email", "jane@test.local");
		assert(state1.kind === "registration");
		await register.sendValidationCode("email", "en", state1);
		const code = message.messages.at(-1)!.text;
		const state2 = await register.submitValidationCode("email", code, state1);
		assert(state2.kind === "registration");
		const state3 = await register.submitPrompt("password", "123", state2);
		assert(state3.kind === "identity");
	});
});
