import { generateKeyPair } from "jose";
import { AuthenticationContext, configureAuthentication } from "./application.ts";
import { sequence } from "./ceremony.ts";
import { EmailIdentityComponentProvider } from "./provider/email.ts";
import { PasswordIdentityComponentProvider } from "./provider/password.ts";
import {
	MemoryDocumentProvider,
	MemoryKVProvider,
	MemoryNotificationProvider,
	MemorySessionProvider,
} from "@baseless/inmemory-provider";
import { assert, assertEquals, assertObjectMatch } from "@std/assert";
import { id } from "../../core/id.ts";

Deno.test("AuthenticationApplication", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const setupServer = () => {
		const notificationProvider = new MemoryNotificationProvider();
		const sessionProvider = new MemorySessionProvider();
		const kvProvider = new MemoryKVProvider();
		const documentProvider = new MemoryDocumentProvider();
		const emailProvider = new EmailIdentityComponentProvider("email");
		const passwordProvider = new PasswordIdentityComponentProvider("password", "le_salt");
		const app = configureAuthentication({
			keys: { ...keyPair, algo: "PS512" },
			ceremony: sequence(
				{ kind: "component", component: "email" },
				{ kind: "component", component: "password" },
			),
			identityComponentProviders: [
				emailProvider,
				passwordProvider,
			],
			notificationProvider,
			sessionProvider,
		})
			.build();
		const context: AuthenticationContext = {
			request: new Request("https://test"),
			currentSession: undefined,
			document: documentProvider as never,
			kv: kvProvider as never,
			notification: notificationProvider as never,
			session: sessionProvider as never,
			waitUntil(promise) {},
		};

		return { app, context, passwordProvider };
	};

	await t.step("authentication.getCeremony", async () => {
		const { app, context } = setupServer();
		const result = await app.invokeRpc({
			key: ["authentication", "getCeremony"],
			input: undefined,
			context,
		});
		assertEquals(
			result,
			{
				ceremony: {
					kind: "sequence",
					components: [
						{ kind: "component", component: "email" },
						{ kind: "component", component: "password" },
					],
				},
				current: {
					kind: "component",
					id: "email",
					prompt: "email",
					options: {},
				},
				state: undefined,
			},
		);
	});
	await t.step("authentication.submitPrompt", async () => {
		const { app, context, passwordProvider } = setupServer();
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
		await context.document.atomic()
			.set(["identities", identity.identityId], identity)
			.set(["identities", identity.identityId, "components", "email"], emailComponent)
			.set(["identities", identity.identityId, "components", "password"], passwordComponent)
			.set(["identifications", "email", "foo@test.local"], identity.identityId)
			.commit();

		let state: string | undefined;
		{
			const result = await app.invokeRpc({
				key: ["authentication", "submitPrompt"],
				input: {
					id: "email",
					value: "foo@test.local",
					state: undefined,
				},
				context,
			});
			assert(result && typeof result === "object");
			assertObjectMatch(
				result,
				{
					ceremony: {
						kind: "sequence",
						components: [
							{ kind: "component", component: "email" },
							{ kind: "component", component: "password" },
						],
					},
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
	});
});
