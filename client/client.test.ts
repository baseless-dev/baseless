// deno-lint-ignore-file require-await no-explicit-any
import { MemoryDocumentProvider, MemoryKVProvider, MemoryNotificationProvider } from "@baseless/inmemory-provider";
import { generateKeyPair } from "jose";
import { Client } from "./client.ts";
import { assert, assertEquals } from "@std/assert";
import { isIdentity } from "@baseless/core/identity";
import {
	ApplicationBuilder,
	component,
	configureAuthentication,
	EmailIdentityComponentProvider,
	Permission,
	sequence,
	Server,
	Type,
} from "@baseless/server";

Deno.test("Client", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const notificationProvider = new MemoryNotificationProvider();
	const setupClient = async () => {
		const kvProvider = new MemoryKVProvider();
		const documentProvider = new MemoryDocumentProvider();
		const emailProvider = new EmailIdentityComponentProvider();
		let ref = 0;
		const appBuilder = new ApplicationBuilder()
			.use(configureAuthentication({
				keys: { ...keyPair, algo: "PS512" },
				ceremony: sequence(component("email")),
				identityComponentProviders: {
					email: emailProvider,
				},
				notificationProvider,
			}))
			.rpc(["hello", "{world}"], {
				input: Type.Void(),
				output: Type.String(),
				security: async () => Permission.All,
				handler: async ({ params }) => `${++ref}. Hello ${params.world}`,
			})
			.collection(["users"], {
				schema: Type.String(),
				security: async () => Permission.All,
			})
			.document(["config"], {
				schema: Type.String(),
				security: async () => Permission.All,
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
		assertEquals(result, "1. Hello World");
	});

	await t.step("batched rpc", async () => {
		using client = await setupClient();
		const [result1, result2, result3, result4] = await Promise.all([
			client.rpc(["hello", "Foo"], void 0),
			client.rpc(["hello", "Bar"], void 0),
			client.rpc(["hello", "Foo"], void 0),
			client.rpc(["hello", "Foo"], void 0, false),
		]);
		assertEquals(result1, "1. Hello Foo");
		assertEquals(result2, "2. Hello Bar");
		assertEquals(result3, "1. Hello Foo");
		assertEquals(result4, "3. Hello Foo");
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

	await t.step("documents", async () => {
		using client = await setupClient();

		await client.documents.atomic()
			.set(["config"], "a")
			.set(["users", "1"], "One")
			.set(["users", "2"], "Two")
			.commit();

		const config = await client.documents(["config"]).get();
		assertEquals(config.data, "a");

		const users = await Array.fromAsync(client.collections(["users"]).list());
		assert(users.length === 2);
		assertEquals(users[0].document.data, "One");
		assertEquals(users[1].document.data, "Two");

		// for await (const config of client.documents(["config"]).watch()) {
		// 	console.log(config.data);
		// }
	});
});
