import { generateKeyPair } from "jose";
import { configureAuthentication } from "./application.ts";
import { sequence } from "./ceremony.ts";
import { EmailIdentityComponentProvider } from "./provider/email.ts";
import { PasswordIdentityComponentProvider } from "./provider/password.ts";
import {
	MemoryDocumentProvider,
	MemoryKVProvider,
	MemoryNotificationProvider,
} from "@baseless/inmemory-provider";
import { assert, assertEquals, assertObjectMatch } from "@std/assert";
import { id } from "../../core/id.ts";
import { AuthenticationContext } from "./types.ts";

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
			ceremony: sequence(
				{ kind: "component", component: "email1" },
				{ kind: "component", component: "password" },
			),
			identityComponentProviders: {
				email1: emailProvider,
				password: passwordProvider,
			},
			notificationProvider,
		})
			.build();
		const context: AuthenticationContext = {
			request: new Request("https://test"),
			currentSession: undefined,
			document: documentProvider as never,
			kv: kvProvider as never,
			notification: notificationProvider as never,
			waitUntil(promise) {},
		};
		const identity = { identityId: id("id_") };
		const emailComponent = {
			identityId: identity.identityId,
			componentId: "email1",
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
			.set(["identities", identity.identityId, "components", "email1"], emailComponent)
			.set(["identities", identity.identityId, "components", "password"], passwordComponent)
			.set(["identifications", "email1", emailComponent.identification], identity.identityId)
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
					kind: "sequence",
					components: [
						{ kind: "component", component: "email1" },
						{ kind: "component", component: "password" },
					],
				},
				current: {
					kind: "component",
					id: "email1",
					prompt: "email",
					options: {},
				},
				state: undefined,
			},
		);
	});
	await t.step("authentication.submitPrompt", async () => {
		const { app, context } = await setupServer();

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
					ceremony: {
						kind: "sequence",
						components: [
							{ kind: "component", component: "email1" },
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
