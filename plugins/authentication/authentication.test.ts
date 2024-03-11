import {
	assert,
	assertEquals,
	assertObjectMatch,
} from "https://deno.land/std@0.213.0/assert/mod.ts";
import { generateKeyPair } from "npm:jose@5.2.0";
import { oneOf, sequence } from "../../lib/authentication/types.ts";
import EmailAuthentificationComponent from "../../providers/auth/email/mod.ts";
import OTPMemoryAuthentificationComponent from "../../providers/auth/otp-memory/mod.ts";
import PasswordAuthentificationComponent from "../../providers/auth/password/mod.ts";
import { MemoryDocumentProvider } from "../../providers/document/memory/mod.ts";
import { DocumentIdentityProvider } from "../../providers/identity/document/mod.ts";
import { MemoryKVProvider } from "../../providers/kv/memory/mod.ts";
import { MemoryNotificationProvider } from "../../providers/notification/memory/mod.ts";
import AuthenticationService from "./authentication.ts";

Deno.test("AuthenticationService", async (t) => {
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
		const auth = new AuthenticationService(
			[emailProvider, passwordProvider, otpProvider],
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
			auth,
			notificationProvider,
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
			john,
			otpProvider,
		} = await init();

		assertEquals(
			await auth.sendPrompt(
				"otp",
				"en",
				{ kind: "authentication", identity: john.id, choices: ["email"] },
			),
			true,
		);
		const code = otpProvider.codes.at(-1);
		assert(code);
		const result2 = await auth.submitPrompt(
			"otp",
			code,
			{ kind: "authentication", identity: john.id, choices: ["email"] },
		);
		assertEquals(result2, true);
	});
});
