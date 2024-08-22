import { generateKeyPair } from "jose";
import { configureAuthentication } from "./application.ts";
import { choice, sequence } from "./ceremony.ts";
import { EmailIdentityComponentProvider } from "./provider/email.ts";
import { PasswordIdentityComponentProvider } from "./provider/password.ts";
import {
	MemoryDocumentProvider,
	MemoryKVProvider,
	MemoryNotificationProvider,
} from "@baseless/inmemory-provider";
import { assert, assertEquals, assertObjectMatch } from "@std/assert";
import { id } from "@baseless/core/id";
import { AuthenticationContext } from "./types.ts";
import { DocumentProviderFacade } from "../application/documentfacade.ts";

Deno.test("AuthenticationApplication", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const setupServer = async () => {
		const notificationProvider = new MemoryNotificationProvider();
		const kvProvider = new MemoryKVProvider();
		const documentProvider = new MemoryDocumentProvider();
		const emailProvider = new EmailIdentityComponentProvider();
		const passwordProvider = new PasswordIdentityComponentProvider("le_salt");
		const app = configureAuthentication({
			keys: { ...keyPair, algo: "PS512" },
			ceremony: choice(
				sequence(
					{ kind: "component", component: "email1" },
					{ kind: "component", component: "password" },
				),
				sequence(
					{ kind: "component", component: "email2" },
					{ kind: "component", component: "email1" },
					{ kind: "component", component: "password" },
				),
			),
			identityComponentProviders: {
				email1: emailProvider,
				email2: emailProvider,
				password: passwordProvider,
			},
			notificationProvider,
		})
			.build();
		const context: AuthenticationContext = {
			request: new Request("https://test"),
			currentSession: undefined,
			document: {} as never,
			kv: kvProvider as never,
			notification: notificationProvider as never,
			waitUntil(promise) {},
		};
		context.document = new DocumentProviderFacade(app, context, documentProvider) as never;
		const identity = { identityId: id("id_") };
		const email1Component = {
			identityId: identity.identityId,
			componentId: "email1",
			identification: "foo@test.local",
			confirmed: true,
			data: {},
		};
		const email2Component = {
			identityId: identity.identityId,
			componentId: "email2",
			identification: "bar@test.local",
			confirmed: true,
			data: {},
		};
		const passwordComponent = {
			identityId: identity.identityId,
			componentId: "password",
			confirmed: true,
			data: {
				hash: await passwordProvider.hashPassword("password"),
			},
		};
		await context.document.atomic()
			.set(["identities", identity.identityId], identity)
			.set(["identities", identity.identityId, "components", "email1"], email1Component)
			.set(["identities", identity.identityId, "components", "email2"], email2Component)
			.set(["identities", identity.identityId, "components", "password"], passwordComponent)
			.commit();

		return { app, context, identity };
	};

	await t.step("authentication.getCeremony", async () => {
		const { app, context } = await setupServer();
		const result = await app.invokeRpc({
			key: ["authentication", "getCeremony"],
			input: undefined,
			context,
		});
		assertEquals(
			result,
			{
				ceremony: {
					kind: "choice",
					components: [
						{
							kind: "sequence",
							components: [
								{ kind: "component", component: "email1" },
								{ kind: "component", component: "password" },
							],
						},
						{
							kind: "sequence",
							components: [
								{ kind: "component", component: "email2" },
								{ kind: "component", component: "email1" },
								{ kind: "component", component: "password" },
							],
						},
					],
				},
				current: {
					kind: "choice",
					prompts: [
						{
							kind: "component",
							id: "email1",
							prompt: "email",
							options: {},
						},
						{
							kind: "component",
							id: "email2",
							prompt: "email",
							options: {},
						},
					],
				},
				state: undefined,
			},
		);
	});
	await t.step("authentication.submitPrompt", async () => {
		const { app, context } = await setupServer();

		// SignIn email1 -> password
		{
			let state: string | undefined;
			{
				const result = await app.invokeRpc({
					key: ["authentication", "submitPrompt"],
					input: {
						id: "email1",
						value: "foo@test.local",
						state: undefined,
					},
					context,
				});
				assert(result && typeof result === "object");
				assertObjectMatch(
					result,
					{
						current: {
							kind: "component",
							id: "password",
							prompt: "password",
							options: {},
						},
					},
				);
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					key: ["authentication", "submitPrompt"],
					input: {
						id: "password",
						value: "password",
						state,
					},
					context,
				});
				assert(result && typeof result === "object");
				assert("access_token" in result && typeof result.access_token === "string");
			}
		}
		// SignIn email2 -> email1 -> password
		{
			let state: string | undefined;
			{
				const result = await app.invokeRpc({
					key: ["authentication", "submitPrompt"],
					input: {
						id: "email2",
						value: "bar@test.local",
						state: undefined,
					},
					context,
				});
				assert(result && typeof result === "object");
				assertObjectMatch(
					result,
					{
						current: {
							kind: "component",
							id: "email1",
							prompt: "email",
							options: {},
						},
					},
				);
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					key: ["authentication", "submitPrompt"],
					input: {
						id: "email1",
						value: "foo@test.local",
						state,
					},
					context,
				});
				assert(result && typeof result === "object");
				assertObjectMatch(
					result,
					{
						current: {
							kind: "component",
							id: "password",
							prompt: "password",
							options: {},
						},
					},
				);
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					key: ["authentication", "submitPrompt"],
					input: {
						id: "password",
						value: "password",
						state,
					},
					context,
				});
				assert(result && typeof result === "object");
				assert("access_token" in result && typeof result.access_token === "string");
			}
		}
	});
	await t.step("registration.getCeremony", async () => {
		const { app, context } = await setupServer();
		const result = await app.invokeRpc({
			key: ["registration", "getCeremony"],
			input: undefined,
			context,
		});
		assertEquals(
			result,
			{
				ceremony: {
					kind: "choice",
					components: [
						{
							kind: "sequence",
							components: [
								{ kind: "component", component: "email1" },
								{ kind: "component", component: "password" },
							],
						},
						{
							kind: "sequence",
							components: [
								{ kind: "component", component: "email2" },
								{ kind: "component", component: "email1" },
								{ kind: "component", component: "password" },
							],
						},
					],
				},
				current: {
					kind: "choice",
					prompts: [
						{
							kind: "component",
							id: "email1",
							prompt: "email",
							options: {},
						},
						{
							kind: "component",
							id: "email2",
							prompt: "email",
							options: {},
						},
					],
				},
				state: undefined,
				validating: false,
			},
		);
	});
	await t.step("registration.submitPrompt", async () => {
		const { app, context } = await setupServer();

		// Register email1 -> password
		{
			let state: string | undefined;
			{
				const result = await app.invokeRpc({
					key: ["registration", "submitPrompt"],
					input: {
						id: "email1",
						value: "john@test.local",
						state: undefined,
					},
					context,
				});
				assert(result && typeof result === "object");
				assertObjectMatch(
					result,
					{
						validating: true,
						current: {
							kind: "component",
							id: "email1",
							prompt: "otp",
							options: {
								digits: 8,
							},
						},
					},
				);
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			let code: string | undefined;
			{
				const notifications = (context.notification as MemoryNotificationProvider).notifications;
				notifications.clear();
				const result = await app.invokeRpc({
					key: ["registration", "sendValidationCode"],
					input: {
						id: "email1",
						locale: "en",
						state,
					},
					context,
				});
				assert(result === true);
				assert(notifications.size === 1);
				code = Array.from(notifications.values()).at(0)!.at(0)!.content["text/x-code"];
				assert(code && code.length > 0);
			}
			{
				const result = await app.invokeRpc({
					key: ["registration", "submitValidationCode"],
					input: {
						id: "email1",
						value: code,
						state,
					},
					context,
				});
				assert(result && typeof result === "object");
				assertObjectMatch(
					result,
					{
						validating: false,
						current: {
							kind: "component",
							id: "password",
							prompt: "password",
							options: {},
						},
					},
				);
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					key: ["registration", "submitPrompt"],
					input: {
						id: "password",
						value: "123",
						state,
					},
					context,
				});
				assert(result && typeof result === "object");
				assert("access_token" in result && typeof result.access_token === "string");
			}
		}
	});
});
