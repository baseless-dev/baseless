// deno-lint-ignore-file explicit-function-return-type
import { generateKeyPair } from "jose";
import { configureAuthentication } from "./configure_authentication_application.ts";
import { component, sequence } from "@baseless/core/authentication-ceremony";
import { EmailIdentityComponentProvider } from "./providers/email.ts";
import { PasswordIdentityComponentProvider } from "./providers/password.ts";
import { MemoryDocumentProvider, MemoryEventProvider, MemoryKVProvider, MemoryNotificationProvider } from "@baseless/inmemory-provider";
import { assert, assertObjectMatch } from "@std/assert";
import { id } from "@baseless/core/id";
import { PolicyIdentityComponentProvider } from "./providers/policy.ts";
import { ApplicationBuilder } from "./application_builder.ts";
import { DenoHubProvider } from "@baseless/deno-provider";
import { Server } from "./server.ts";

Deno.test("AuthenticationApplication", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const setupServer = async () => {
		const app = new ApplicationBuilder()
			.use(configureAuthentication({
				ceremony: async ({ flow }) =>
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
						),
			}))
			.build();
		const hubProvider = new DenoHubProvider();
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
		const notificationProvider = new MemoryNotificationProvider();
		const server = new Server(app, {
			document: new MemoryDocumentProvider(),
			event: new MemoryEventProvider(hubProvider),
			hub: hubProvider,
			kv: new MemoryKVProvider(),
		}, {
			authenticationKeys: { ...keyPair, algo: "PS512" },
			channelProviders: {
				"email": notificationProvider,
			},
			identityComponentProviders: {
				email: emailProvider,
				password: passwordProvider,
				policy: policyProvider,
			},
		});
		const [context] = await server.makeContext(new Request("http://localhost"));
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
		const otpChannel = {
			identityId: identity.identityId,
			channelId: "email",
			data: {},
		};
		await context.document.atomic()
			.set(["identities", identity.identityId], identity)
			.set(["identities", identity.identityId, "components", "email"], emailComponent)
			.set(["identities", identity.identityId, "components", "password"], passwordComponent)
			.set(["identities", identity.identityId, "components", "policy"], policyComponent)
			.set(["identities", identity.identityId, "channels", "email"], otpChannel)
			.commit();

		return { app, context, identity, notificationProvider };
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
		const { app, context, notificationProvider } = await setupServer();

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
				const result = await app.invokeRpc({
					rpc: ["registration", "sendValidationCode"],
					input: { id: "email", locale: "en", state },
					context,
				});
				assert(result === true);
				code = notificationProvider.notifications.at(-1)!.content["text/x-code"];
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
