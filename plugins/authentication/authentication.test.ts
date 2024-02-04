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
		const auth = new AuthenticationService(
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
			auth,
			message,
			email,
			password,
			otp,
			john,
		};
	};

	await t.step("get sign in ceremony", async () => {
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
		assert(message.messages.at(-1));
	});
});
