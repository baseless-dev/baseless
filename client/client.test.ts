// deno-lint-ignore-file require-await no-explicit-any
import { MemoryDocumentProvider, MemoryKVProvider, MemoryNotificationProvider } from "@baseless/inmemory-provider";
import {
	ApplicationBuilder,
	AuthenticationConfiguration,
	component,
	configureAuthentication,
	Permission,
	sequence,
	Server,
} from "@baseless/server";
import { EmailIdentityComponentProvider } from "@baseless/server/authentication";
import { generateKeyPair } from "jose";
import { Client } from "./client.ts";
import { Type } from "@sinclair/typebox";
import { assert, assertEquals } from "@std/assert";
import { isIdentity } from "@baseless/core/identity";

Deno.test("Client", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const notificationProvider = new MemoryNotificationProvider();
	const setupClient = async (
		options?: Partial<
			Pick<AuthenticationConfiguration, "ceremony" | "identityComponentProviders">
		>,
	) => {
		const kvProvider = new MemoryKVProvider();
		const documentProvider = new MemoryDocumentProvider();
		const emailProvider = new EmailIdentityComponentProvider();
		const appBuilder = new ApplicationBuilder()
			.use(configureAuthentication({
				keys: { ...keyPair, algo: "PS512" },
				ceremony: options?.ceremony ?? sequence(component("email")),
				identityComponentProviders: options?.identityComponentProviders ?? {
					email: emailProvider,
				},
				notificationProvider,
			}))
			.rpc(["hello", "{world}"], {
				input: Type.Void(),
				output: Type.String(),
				security: async () => Permission.All,
				handler: async ({ params }) => `Hello ${params.world}`,
			});

		const app = appBuilder.build();

		const server = new Server({
			application: app,
			document: documentProvider,
			kv: kvProvider,
		});

		const client = Client.fromApplicationBuilder<typeof appBuilder>({
			clientId: "test",
			apiEndpoint: "http://test.local",
			async fetch(input, init): Promise<Response> {
				const request = new Request(input, init);
				const [response, _promises] = await server.handleRequest(request);
				return response;
			},
		});

		return client;
	};

	await t.step("single rpc", async () => {
		using client = await setupClient();
		const result = await client.rpc(["hello", "World"], void 0);
		assertEquals(result, "Hello World");
	});

	await t.step("batched rpc", async () => {
		using client = await setupClient();
		const [result1, result2, result3] = await Promise.all([
			client.rpc(["hello", "Foo"], void 0),
			client.rpc(["hello", "Bar"], void 0),
			client.rpc(["hello", "Foo"], void 0),
		]);
		assertEquals(result1, "Hello Foo");
		assertEquals(result2, "Hello Bar");
		assertEquals(result3, "Hello Foo");
	});

	await t.step("onAuthenticationStateChange", async () => {
		using client = await setupClient();
		const events: any[] = [];
		using _listener = client.onAuthenticationStateChange((identity) => {
			events.push(identity);
		});

		const begin = await client.rpc(["registration", "begin"], void 0);
		assert("state" in begin);

		const submitEmail = await client.rpc(["registration", "submitPrompt"], {
			id: "email",
			value: "foo@test.local",
			state: begin.state,
		});
		assert("state" in submitEmail);

		notificationProvider.notifications.clear();
		const sendValidationCode = await client.rpc(["registration", "sendValidationCode"], {
			id: "email",
			locale: "en",
			state: submitEmail.state,
		});
		assert(sendValidationCode === true);
		const code = Array.from(notificationProvider.notifications.values()).at(0)!.at(0)!
			.content["text/x-code"];
		assert(code && code.length > 0);

		const submitValidationCode = await client.rpc(["registration", "submitValidationCode"], {
			id: "email",
			value: code,
			state: submitEmail.state,
		});
		assert("access_token" in submitValidationCode);

		assert(await client.rpc(["authentication", "signOut"], void 0) === true);

		assert(events.length === 2);
		assert(isIdentity(events[0]));
		assert(events[1] === undefined);
	});
});
