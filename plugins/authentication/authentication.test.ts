import { assert, assertObjectMatch } from "../../deps.test.ts";
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
		const authService = new AuthenticationService(
			ceremony,
			identity,
			keys,
		);
		const john = await identity.create({}, {
			email: {
				id: "email",
				...await email.initializeIdentityComponent({
					value: "john@test.local",
				}),
			},
			password: {
				id: "password",
				...await password.initializeIdentityComponent({ value: "123" }),
			},
			otp: {
				id: "otp",
				...await otp.initializeIdentityComponent({ value: "" }),
			},
		});
		return {
			authService,
			message,
			email,
			password,
			otp,
			john,
		};
	};

	await t.step("get sign in ceremony", async () => {
		const { authService } = await init();
		assertObjectMatch(
			await authService.getCeremony(),
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
			authService,
			john,
		} = await init();

		const state1 = await authService.submitPrompt("email", "john@test.local");
		assertObjectMatch(
			state1,
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
			await authService.submitPrompt(
				"password",
				"123",
				state1.done === false ? state1.state : undefined,
			),
			{
				done: true,
			},
		);
	});

	await t.step("send prompt", async () => {
		const {
			authService,
			message,
			john,
		} = await init();

		const state1 = await authService.submitPrompt("email", "john@test.local");
		assertObjectMatch(
			await authService.sendPrompt(
				"otp",
				"en",
				state1.done === false ? state1.state! : "",
			),
			{
				sent: true,
			},
		);
		assert(message.messages.at(-1));
	});

	await t.step("submit & send prompt", async () => {
		const {
			authService,
			message,
			john,
		} = await init();

		const state1 = await authService.submitPrompt("email", "john@test.local");
		await authService.sendPrompt(
			"otp",
			"en",
			state1.done === false ? state1.state! : "",
		);
		const code = message.messages.at(-1)!.text;
		assertObjectMatch(
			await authService.submitPrompt(
				"otp",
				code,
				state1.done === false ? state1.state! : "",
			),
			{
				done: true,
			},
		);
	});
});
