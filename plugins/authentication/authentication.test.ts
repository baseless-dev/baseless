import { assert, assertEquals, assertObjectMatch } from "../../deps.test.ts";
import { generateKeyPair } from "../../deps.ts";
import { oneOf, sequence } from "../../lib/authentication/types.ts";
import EmailAuthentificationComponent from "../../providers/auth-email/mod.ts";
import OTPMessageAuthentificationComponent from "../../providers/auth-otp-message/mod.ts";
import PasswordAuthentificationComponent from "../../providers/auth-password/mod.ts";
import { MemoryDocumentProvider } from "../../providers/document-memory/mod.ts";
import { DocumentIdentityProvider } from "../../providers/identity-document/mod.ts";
import { MemoryKVProvider } from "../../providers/kv-memory/mod.ts";
import { MemoryMessageProvider } from "../../providers/message-memory/mod.ts";
import AuthenticationService from "./authentication.ts";

Deno.test("AuthenticationService", async (t) => {
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
		const auth = new AuthenticationService(
			[emailProvider, passwordProvider, otpProvider],
			ceremony,
			identity,
			keys,
		);
		const john = await identity.create({}, [
			{
				id: "email",
				...await emailProvider.configureIdentityComponent("john@test.local"),
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
			auth,
			message,
			emailProvider,
			passwordProvider,
			otpProvider,
			john,
		};
	};

	await t.step("get ceremony", async () => {
		const { auth } = await init();
		assertObjectMatch(
			await auth.getCeremony(),
			{
				done: false,
				first: true,
				last: false,
				component: { id: "email" },
			},
		);
	});

	await t.step("submit prompt", async () => {
		const {
			auth,
			john,
		} = await init();

		const result1 = await auth.submitPrompt("email", "john@test.local");
		assertEquals(result1, john);
		const result2 = await auth.submitPrompt(
			"password",
			"123",
			{ kind: "authentication", identity: john.id, choices: ["email"] },
		);
		assertEquals(result2, true);
	});

	await t.step("send prompt", async () => {
		const {
			auth,
			message,
			john,
		} = await init();

		assertEquals(
			await auth.sendPrompt(
				"otp",
				"en",
				{ kind: "authentication", identity: john.id, choices: ["email"] },
			),
			true,
		);
		const code = message.messages.at(-1)?.text;
		assert(code);
		const result2 = await auth.submitPrompt(
			"otp",
			code,
			{ kind: "authentication", identity: john.id, choices: ["email"] },
		);
		assertEquals(result2, true);
	});
});
