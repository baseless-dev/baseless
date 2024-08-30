// deno-lint-ignore-file explicit-function-return-type
import { generateKeyPair } from "jose";
import { configureAuthentication } from "./application.ts";
import { choice, component, sequence } from "./ceremony.ts";
import { EmailIdentityComponentProvider } from "./provider/email.ts";
import { PasswordIdentityComponentProvider } from "./provider/password.ts";
import { MemoryDocumentProvider, MemoryKVProvider, MemoryNotificationProvider } from "@baseless/inmemory-provider";
import { assert, assertEquals, assertObjectMatch } from "@std/assert";
import { id } from "@baseless/core/id";
import { AuthenticationConfiguration, AuthenticationContext } from "./types.ts";
import { ApplicationDocumentProviderFacade } from "../application/documentfacade.ts";
import { PolicyIdentityComponentProvider } from "./provider/policy.ts";

Deno.test("AuthenticationApplication", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const setupServer = async (
		options?: Partial<
			Pick<
				AuthenticationConfiguration,
				"ceremony" | "identityComponentProviders"
			>
		>,
	) => {
		const notificationProvider = new MemoryNotificationProvider();
		const kvProvider = new MemoryKVProvider();
		const documentProvider = new MemoryDocumentProvider();
		const emailProvider = new EmailIdentityComponentProvider();
		const passwordProvider = new PasswordIdentityComponentProvider("le_salt");
		const policyProvider = new PolicyIdentityComponentProvider([{
			identifier: "tos",
			version: "1",
			required: true,
			name: { en: "Terms of Services" },
			content: { en: "..." },
		}, {
			identifier: "privacy",
			version: "2",
			required: false,
			name: { en: "Privacy Policy" },
			content: { en: "..." },
		}]);
		const app = configureAuthentication({
			keys: { ...keyPair, algo: "PS512" },
			ceremony: options?.ceremony ??
				(async ({ flow }) =>
					flow === "authentication"
						? sequence(
							component("email"),
							component("password"),
							component("policy"),
						)
						: sequence(
							component("policy"),
							component("email"),
							component("password"),
						)),
			identityComponentProviders: options?.identityComponentProviders ?? {
				email: emailProvider,
				password: passwordProvider,
				policy: policyProvider,
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
			waitUntil(_promise) {},
		};
		context.document = new ApplicationDocumentProviderFacade(
			app,
			context,
			documentProvider,
		) as never;
		const identity = { identityId: id("id_") };
		const emailComponent = {
			identityId: identity.identityId,
			componentId: "email",
			identification: "foo@test.local",
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
		const policyComponent = {
			identityId: identity.identityId,
			componentId: "policy",
			confirmed: true,
			data: {},
		};
		await context.document.atomic()
			.set(["identities", identity.identityId], identity)
			.set(["identities", identity.identityId, "components", "email"], emailComponent)
			.set(["identities", identity.identityId, "components", "password"], passwordComponent)
			.set(["identities", identity.identityId, "components", "policy"], policyComponent)
			.commit();

		return { app, context, identity };
	};

	await t.step("authentication.begin", async () => {
		const { app, context } = await setupServer();
		const result = await app.invokeRpc({
			rpc: ["authentication", "begin"],
			input: [],
			context,
		});
		assert(result && typeof result === "object");
		assert("state" in result && typeof result.state === "string");
		assertObjectMatch(result, {
			ceremony: {
				kind: "sequence",
				components: [
					{ kind: "component", component: "email" },
					{ kind: "component", component: "password" },
					{ kind: "component", component: "policy" },
				],
			},
		});
	});
	await t.step("authentication.submitPrompt", async () => {
		const { app, context } = await setupServer();
		// Sign-in with email + password and accept policies
		{
			let state: string | undefined;
			{
				const result = await app.invokeRpc({
					rpc: ["authentication", "begin"],
					input: [],
					context,
				});
				assert(result && typeof result === "object");
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					rpc: ["authentication", "submitPrompt"],
					input: { id: "email", value: "foo@test.local", state },
					context,
				});
				assert(result && typeof result === "object");
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					rpc: ["authentication", "submitPrompt"],
					input: { id: "password", value: "password", state },
					context,
				});
				assert(result && typeof result === "object");
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					rpc: ["authentication", "submitPrompt"],
					input: { id: "policy", value: { tos: "1", privacy: "2" }, state },
					context,
				});
				assert(result && typeof result === "object");
				assert("access_token" in result && typeof result.access_token === "string");
			}
		}
		// Now that policies are accepted, sign-in with email + password only
		{
			let state: string | undefined;
			{
				const result = await app.invokeRpc({
					rpc: ["authentication", "begin"],
					input: [],
					context,
				});
				assert(result && typeof result === "object");
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					rpc: ["authentication", "submitPrompt"],
					input: { id: "email", value: "foo@test.local", state },
					context,
				});
				assert(result && typeof result === "object");
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					rpc: ["authentication", "submitPrompt"],
					input: { id: "password", value: "password", state },
					context,
				});
				assert(result && typeof result === "object");
				assert("access_token" in result && typeof result.access_token === "string");
			}
		}
	});
	await t.step("registration.begin", async () => {
		const { app, context } = await setupServer();
		const result = await app.invokeRpc({
			rpc: ["registration", "begin"],
			input: void 0,
			context,
		});
		assert(result && typeof result === "object");
		assert("state" in result && typeof result.state === "string");
		assertObjectMatch(result, {
			ceremony: {
				kind: "sequence",
				components: [
					{ kind: "component", component: "policy" },
					{ kind: "component", component: "email" },
					{ kind: "component", component: "password" },
				],
			},
		});
	});
	await t.step("registration.submitPrompt", async () => {
		const { app, context } = await setupServer();

		// Register policy and email + password
		{
			let state: string | undefined;
			{
				const result = await app.invokeRpc({
					rpc: ["registration", "begin"],
					input: void 0,
					context,
				});
				assert(result && typeof result === "object");
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					rpc: ["registration", "submitPrompt"],
					input: { id: "policy", value: { tos: "1", privacy: "2" }, state },
					context,
				});
				assert(result && typeof result === "object");
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					rpc: ["registration", "submitPrompt"],
					input: {
						id: "email",
						value: "john@test.local",
						state,
					},
					context,
				});
				assert(result && typeof result === "object");
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			let code: string | undefined;
			{
				const notifications = (context.notification as MemoryNotificationProvider).notifications;
				notifications.clear();
				const result = await app.invokeRpc({
					rpc: ["registration", "sendValidationCode"],
					input: { id: "email", locale: "en", state },
					context,
				});
				assert(result === true);
				assert(notifications.size === 1);
				code = Array.from(notifications.values()).at(0)!.at(0)!.content["text/x-code"];
				assert(code && code.length > 0);
			}
			{
				const result = await app.invokeRpc({
					rpc: ["registration", "submitValidationCode"],
					input: { id: "email", value: code, state },
					context,
				});
				assert(result && typeof result === "object");
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					rpc: ["registration", "submitPrompt"],
					input: { id: "password", value: "123", state },
					context,
				});
				assert(result && typeof result === "object");
				assert("access_token" in result && typeof result.access_token === "string");
			}
		}
		// Sign-in with email + password only
		{
			let state: string | undefined;
			{
				const result = await app.invokeRpc({
					rpc: ["authentication", "begin"],
					input: [],
					context,
				});
				assert(result && typeof result === "object");
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					rpc: ["authentication", "submitPrompt"],
					input: { id: "email", value: "john@test.local", state },
					context,
				});
				assert(result && typeof result === "object");
				assert("state" in result && typeof result.state === "string");
				state = result.state;
			}
			{
				const result = await app.invokeRpc({
					rpc: ["authentication", "submitPrompt"],
					input: { id: "password", value: "123", state },
					context,
				});
				assert(result && typeof result === "object");
				assert("access_token" in result && typeof result.access_token === "string");
			}
		}
	});
});
