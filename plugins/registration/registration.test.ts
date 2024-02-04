import {
	assert,
	assertEquals,
	assertObjectMatch,
	assertRejects,
} from "../../deps.test.ts";
import { generateKeyPair } from "../../deps.ts";
import { oneOf, sequence } from "../../lib/authentication/types.ts";
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
		const email = new EmailAuthentificationComponent(
			"email",
			identity,
			kv,
			message,
		);
		const password = new PasswordAuthentificationComponent(
			"password",
			"lesalt",
		);
		const otp = new OTPMessageAuthentificationComponent(
			"otp",
			kv,
			message,
			{
				digits: 6,
			},
		);
		const ceremony = sequence(
			email,
			oneOf(password, otp),
		);
		const register = new RegistrationService(
			ceremony,
			identity,
			keys,
		);
		const john = await identity.create({}, [
			{
				id: "email",
				...await email.initializeIdentityComponent({
					value: "john@test.local",
				}),
			},
			{
				id: "password",
				...await password.initializeIdentityComponent({ value: "123" }),
			},
			{
				id: "otp",
				...await otp.initializeIdentityComponent({ value: "" }),
			},
		]);
		return {
			register,
			message,
			email,
			password,
			otp,
			john,
		};
	};

	await t.step("get ceremony", async () => {
		const { register } = await init();
		assertObjectMatch(
			await register.getCeremony(),
			{
				done: false,
				first: true,
				last: false,
				component: { id: "email" },
			},
		);
	});

	await t.step("submit prompt", async () => {
		const { register } = await init();

		const state1 = await register.submitPrompt("email", "jane@test.local");
		assertObjectMatch(
			state1,
			{
				components: [
					{
						id: "email",
						confirmed: false,
						identification: "jane@test.local",
					},
				],
			},
		);
		assert(state1.kind === "registration");
		assertObjectMatch(
			register.getCeremony(state1),
			{
				done: false,
				first: false,
				last: false,
				forComponent: {
					id: "email",
				},
				validationComponent: {
					id: "validation",
				},
			},
		);
		await assertRejects(() =>
			register.submitPrompt("validation", "123", state1)
		);
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
		const { register, message } = await init();

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
						confirmed: true,
						identification: "jane@test.local",
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
