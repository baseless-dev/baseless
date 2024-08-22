import {
	MemoryDocumentProvider,
	MemoryKVProvider,
	MemoryNotificationProvider,
} from "@baseless/inmemory-provider";
import {
	ApplicationBuilder,
	choice,
	configureAuthentication,
	sequence,
	Server,
} from "@baseless/server";
import {
	EmailIdentityComponentProvider,
	PasswordIdentityComponentProvider,
} from "@baseless/server/authentication";
import { generateKeyPair } from "jose";
import { Client } from "./client.ts";
import { Type } from "@sinclair/typebox";
import { assert, assertEquals } from "@std/assert";

Deno.test("Client", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const setupServer = async () => {
		const notificationProvider = new MemoryNotificationProvider();
		const kvProvider = new MemoryKVProvider();
		const documentProvider = new MemoryDocumentProvider();
		const emailProvider = new EmailIdentityComponentProvider();
		const passwordProvider = new PasswordIdentityComponentProvider("le_salt");
		const appBuilder = new ApplicationBuilder()
			.use(configureAuthentication({
				keys: { ...keyPair, algo: "PS512" },
				ceremony: sequence(
					{ kind: "component", component: "email" },
					{ kind: "component", component: "password" },
				),
				identityComponentProviders: {
					email: emailProvider,
					password: passwordProvider,
				},
				notificationProvider,
			}))
			.rpc(["hello", "{world}"], {
				input: Type.Void(),
				output: Type.String(),
				security: async () => "allow",
				handler: async ({ params }) => `Hello ${params.world}`,
			});

		const client = Client.fromApplicationBuilder<typeof appBuilder>({
			clientId: "test",
			apiEndpoint: "http://test.local",
			async fetch(input, init): Promise<Response> {
				const request = new Request(input, init);
				const [response, promises] = await server.handleRequest(request);
				return response;
			},
		});

		const app = appBuilder.build();

		const server = new Server({
			application: app,
			document: documentProvider,
			kv: kvProvider,
		});

		return { client, notificationProvider };
	};

	await t.step("hello world", async () => {
		const { client } = await setupServer();
		const result = await client.rpc(["hello", "World"], void 0);
		assertEquals(result, "Hello World");
	});

	await t.step("batched hello world", async () => {
		const { client } = await setupServer();
		const [result1, result2, result3] = await Promise.all([
			client.rpc(["hello", "Foo"], void 0),
			client.rpc(["hello", "Bar"], void 0),
			client.rpc(["hello", "Foo"], void 0),
		]);
		assertEquals(result1, "Hello Foo");
		assertEquals(result2, "Hello Bar");
		assertEquals(result3, "Hello Foo");
	});

	await t.step("register & onAuthenticationStateChange", async () => {
		const { client, notificationProvider } = await setupServer();
		const submitEmail = await client.rpc(["registration", "submitPrompt"], {
			id: "email",
			value: "foo@test.local",
			state: undefined,
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
		assert("state" in submitValidationCode);

		const stack: any[] = [];
		const unlisten = client.onAuthenticationStateChange((identity) => {
			stack.push(identity);
		});

		const submitPassword = await client.rpc(["registration", "submitPrompt"], {
			id: "password",
			value: "123",
			state: submitValidationCode.state,
		});
		assert("access_token" in submitPassword);

		assert(stack.length === 1);
		unlisten();

		client.dispose();
	});
});
