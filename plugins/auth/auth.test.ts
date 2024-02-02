import { assertEquals, assertObjectMatch } from "../../deps.test.ts";
import { generateKeyPair } from "../../deps.ts";
import { oneOf, sequence } from "../../lib/auth/types.ts";
import EmailAuthentificationComponent from "../../providers/auth-email/mod.ts";
import OTPLoggerAuthentificationComponent from "../../providers/auth-otp-logger/mod.ts";
import PasswordAuthentificationComponent from "../../providers/auth-password/mod.ts";
import { MemoryCounterProvider } from "../../providers/counter-memory/mod.ts";
import { MemoryDocumentProvider } from "../../providers/document-memory/mod.ts";
import { DocumentIdentityProvider } from "../../providers/identity-document/mod.ts";
import { MemoryKVProvider } from "../../providers/kv-memory/mod.ts";
import { MemoryMessageProvider } from "../../providers/message-memory/mod.ts";
import AuthenticationService from "./auth.ts";

Deno.test("AuthService", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const init = () => {
		const messageProvider = new MemoryMessageProvider();
		const kvProvider = new MemoryKVProvider();
		const identityProvider = new DocumentIdentityProvider(
			new MemoryDocumentProvider(),
		);
		const counterProvider = new MemoryCounterProvider();
		const keys = {
			algo: "PS512",
			...keyPair,
		};
		const email = new EmailAuthentificationComponent(
			"email",
			identityProvider,
			kvProvider,
			messageProvider,
		);
		const password = new PasswordAuthentificationComponent(
			"password",
			"lesalt",
		);
		const otp = new OTPLoggerAuthentificationComponent("otp", kvProvider, {
			digits: 6,
		});
		const ceremony = sequence(
			email,
			oneOf(password, otp),
		);
		const authService = new AuthenticationService(
			ceremony,
			identityProvider,
			counterProvider,
			keys,
		);
		return { authService, messageProvider };
	};

	await t.step("get sign in ceremony", () => {
		const { authService } = init();
		assertObjectMatch(
			authService.getSignInCeremony(),
			{
				done: false,
				first: true,
				last: false,
				component: { id: "email" },
			},
		);
	});

	await t.step("get sign in ceremony with state", () => {
		const { authService } = init();
		assertObjectMatch(
			authService.getSignInCeremony({
				kind: "signin" as const,
				choices: ["email"],
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
			authService.getSignInCeremony({
				kind: "signin" as const,
				choices: ["email", "password"],
			}),
			{
				done: true,
			},
		);
	});

	await t.step("get sign up ceremony", () => {
		const { authService } = init();
		assertObjectMatch(
			authService.getSignUpCeremony(),
			{
				done: false,
				first: true,
				last: false,
				component: { id: "email" },
			},
		);
	});

	await t.step("get sign up ceremony with state", () => {
		const { authService } = init();
		assertObjectMatch(
			authService.getSignUpCeremony({ kind: "signup", components: [] }),
			{
				done: false,
				first: true,
				last: false,
				component: { id: "email" },
			},
		);
		assertObjectMatch(
			authService.getSignUpCeremony({
				kind: "signup",
				components: [{
					id: "email",
					confirmed: false,
					meta: {},
					identification: "john@test.local",
				}],
			}),
			{
				done: false,
				first: false,
				last: false,
				component: { id: "validation", kind: "prompt", prompt: "otp" },
			},
		);
		assertObjectMatch(
			authService.getSignUpCeremony({
				kind: "signup",
				components: [{
					id: "email",
					confirmed: true,
					meta: {},
					identification: "john@test.local",
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
			authService.getSignUpCeremony({
				kind: "signup",
				components: [{
					id: "email",
					confirmed: true,
					meta: {},
					identification: "john@test.local",
				}, {
					id: "otp",
					confirmed: false,
					meta: {},
				}],
			}),
			{
				done: false,
				first: false,
				last: false,
				component: { id: "validation", kind: "prompt", prompt: "otp" },
			},
		);
		assertObjectMatch(
			authService.getSignUpCeremony({
				kind: "signup",
				components: [{
					id: "email",
					confirmed: true,
					meta: {},
					identification: "john@test.local",
				}, {
					id: "otp",
					confirmed: true,
					meta: {},
				}],
			}),
			{
				done: true,
			},
		);
	});

	await t.step("submit sign iup prompt", async () => {
		const { authService, messageProvider } = init();
		assertObjectMatch(
			await authService.submitSignUpPrompt("email", "john@test.local"),
			{
				response: {
					done: false,
					first: false,
					last: false,
					component: { id: "validation", kind: "prompt", prompt: "otp" },
				},
			},
		);
		let state = {
			kind: "signup" as const,
			components: [{
				id: "email",
				confirmed: false,
				identification: "john@test.local",
				meta: {},
			}],
		};
		await authService.sendSignUpValidationCode("validation", state);
		assertObjectMatch(
			await authService.submitSignUpPrompt("validation", "123123", state),
			{
				response: {
					done: false,
					first: false,
					last: false,
					component: {
						kind: "choice",
						components: [{ id: "password" }, { id: "otp" }],
					},
				},
			},
		);
	});
});
