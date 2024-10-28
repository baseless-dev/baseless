// deno-lint-ignore-file require-await no-explicit-any
import { MemoryDocumentProvider, MemoryEventProvider, MemoryKVProvider, MemoryNotificationProvider } from "@baseless/inmemory-provider";
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
import { DenoHubProvider } from "@baseless/deno-provider/hub";
import { TypedClientFromApplicationBuilder } from "./types.ts";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

Deno.test("Client", async (t) => {
	const keyPair = await generateKeyPair("PS512");
	const notificationProvider = new MemoryNotificationProvider();
	const setup = async (
		options?: { hostname?: string; port?: number },
	): Promise<TypedClientFromApplicationBuilder<typeof appBuilder>> => {
		const hostname = options?.hostname ?? "localhost";
		const port = options?.port ?? 0;
		const abortController = new AbortController();
		const ready = Promise.withResolvers<URL>();

		const kvProvider = new MemoryKVProvider();
		const documentProvider = new MemoryDocumentProvider();
		const emailProvider = new EmailIdentityComponentProvider();
		const hubProvider = new DenoHubProvider();
		let ref = 0;
		const appBuilder = new ApplicationBuilder()
			.use(configureAuthentication({
				ceremony: sequence(component("email")),
			}))
			.rpc(["hello", "{world}"], {
				input: Type.Void(),
				output: Type.String(),
				security: async () => Permission.All,
				handler: async ({ params }) => `${++ref}. Hello ${params.world}`,
			})
			.event(["foo"], {
				payload: Type.String(),
				security: async () => Permission.All,
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

		const server = new Server(app, {
			document: documentProvider,
			event: new MemoryEventProvider(hubProvider),
			hub: hubProvider,
			kv: kvProvider,
		}, {
			authenticationKeys: { ...keyPair, algo: "PS512" },
			identityComponentProviders: {
				email: emailProvider,
			},
			channelProviders: {
				"email": notificationProvider,
			},
		});

		Deno.serve(
			{
				hostname,
				port,
				signal: abortController.signal,
				onListen(netAddr): void {
					ready.resolve(new URL(`http://${netAddr.hostname === "::1" ? "[::1]" : netAddr.hostname}:${netAddr.port}`));
				},
			},
			async (request) => {
				const [response, _promises] = await server.handleRequest(request);
				return response;
			},
		);

		const url = await ready.promise;

		const client = new Client({
			clientId: "test",
			apiEndpoint: url.toString(),
		});

		const oldDispose = client[Symbol.asyncDispose].bind(client);

		return Object.assign(client, {
			async [Symbol.asyncDispose](): Promise<void> {
				await oldDispose();
				abortController.abort();
			},
		}) as never;
	};

	await t.step("single rpc", async () => {
		await using client = await setup();
		const result = await client.rpc(["hello", "World"], void 0);
		assertEquals(result, "1. Hello World");
	});

	await t.step("batched rpc", async () => {
		await using client = await setup();
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
		await using client = await setup();
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

		const sendValidationCode = await client.rpc(["registration", "sendValidationCode"], {
			id: "email",
			locale: "en",
			state: submitEmail.state,
		});
		assert(sendValidationCode === true);
		const code = notificationProvider.notifications.at(-1)!.content["text/x-code"];
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

	await t.step("events", async () => {
		await using client = await setup();

		const iter = client.events(["foo"]).subscribe();

		{
			const event = iter.next();
			await sleep(20);
			await client.events(["foo"]).publish("Foo");
			assertEquals(await event, { done: false, value: "Foo" });
		}
		{
			const event = iter.next();
			await sleep(20);
			await client.events(["foo"]).publish("Bar");
			assertEquals(await event, { done: false, value: "Bar" });
		}
	});

	await t.step("documents", async () => {
		await using client = await setup();

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

		{
			const iter = client.documents(["config"]).watch();
			{
				const event = iter.next();
				await sleep(20);
				await client.documents.atomic().set(["config"], "b").commit();
				assertEquals(await event, { done: false, value: { type: "set", key: ["config"], data: "b" } });
			}
			{
				const event = iter.next();
				await sleep(20);
				await client.documents.atomic().set(["config"], "c").commit();
				assertEquals(await event, { done: false, value: { type: "set", key: ["config"], data: "c" } });
			}
		}
		{
			const iter = client.collections(["users"]).watch();
			{
				const event = iter.next();
				await sleep(20);
				await client.documents.atomic().set(["users", "1"], "Uno").commit();
				assertEquals(await event, { done: false, value: { type: "set", key: ["users", "1"], data: "Uno" } });
			}
			{
				const event = iter.next();
				await sleep(20);
				await client.documents.atomic().delete(["users", "2"]).commit();
				assertEquals(await event, { done: false, value: { type: "delete", key: ["users", "2"] } });
			}
		}
	});
});
