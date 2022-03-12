import {
	assertEquals,
	assertExists,
	assertNotEquals,
	assertRejects,
} from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.3.7/key/generate_key_pair.ts";
import { Client } from "https://baseless.dev/x/provider/client.ts";
import { MemoryClientProvider } from "https://baseless.dev/x/provider-client-memory/mod.ts";
import { SqliteKVProvider } from "https://baseless.dev/x/provider-kv-sqlite/mod.ts";
import { AuthOnKvProvider } from "https://baseless.dev/x/provider-auth-on-kv/mod.ts";
import { DatabaseOnKvProvider } from "https://baseless.dev/x/provider-db-on-kv/mod.ts";
import {
	auth,
	AuthDescriptor,
	ChannelPermissions,
	database,
	DatabaseDescriptor,
	functions,
	FunctionsBuilder,
	FunctionsDescriptor,
	mail,
	MailDescriptor,
	message,
	MessageBuilder,
	MessageDescriptor,
	MessagePermissions,
} from "https://baseless.dev/x/worker/mod.ts";
import { createLogger, logger } from "https://baseless.dev/x/logger/mod.ts";
import { Server } from "https://baseless.dev/x/server/server.ts";
import { DenoMessageHub } from "https://baseless.dev/x/provider-message-deno/mod.ts";
import { initializeApp } from "./app.ts";
import { exportSPKI } from "https://deno.land/x/jose@v4.3.7/key/export.ts";
import type { KeyLike } from "https://deno.land/x/jose@v4.3.7/types.d.ts";
import { getMessage, join } from "./message.ts";
import { channel } from "https://baseless.dev/x/shared/message.ts";

async function setupServer({
	authDescriptor,
	databaseDescriptor,
	functionsDescriptor,
	mailDescriptor,
	messageDescriptor,
}: {
	authDescriptor?: AuthDescriptor;
	databaseDescriptor?: DatabaseDescriptor;
	functionsDescriptor?: FunctionsDescriptor;
	mailDescriptor?: MailDescriptor;
	messageDescriptor?: MessageDescriptor;
}) {
	authDescriptor = authDescriptor ?? auth.build();
	databaseDescriptor = databaseDescriptor ?? database.build();
	functionsDescriptor = functionsDescriptor ?? functions.build();
	mailDescriptor = mailDescriptor ?? mail.build();
	messageDescriptor = messageDescriptor ?? message.build();

	const authStorage = new SqliteKVProvider(":memory:");
	const dbStorage = new SqliteKVProvider(":memory:");

	const authProvider = new AuthOnKvProvider(authStorage);
	const kvProvider = new SqliteKVProvider(":memory:");
	const databaseProvider = new DatabaseOnKvProvider(dbStorage);

	const { privateKey, publicKey } = await generateKeyPair("RS256");
	const clientProvider = new MemoryClientProvider([
		new Client("foo", "Foobar", ["http://example.org"], "RS256", publicKey, privateKey),
	]);

	const messageHub = new DenoMessageHub(messageDescriptor);

	await authStorage.open();
	const dispose = async () => {
		await authStorage.close();
		await dbStorage.close();
		await kvProvider.close();
	};

	const server = new Server({
		authDescriptor,
		databaseDescriptor,
		functionsDescriptor,
		mailDescriptor,
		messageDescriptor,
		clientProvider,
		authProvider,
		kvProvider,
		databaseProvider,
		messageHub,
	});

	return { server, dispose, publicKey };
}

async function setupApp(server: Server, publicKey: KeyLike) {
	const clientPublicKey = await exportSPKI(publicKey);
	const app = await initializeApp({
		baselessUrl: "http://localhost:31000",
		clientPublicKey,
		clientPublicKeyAlg: "RS256",
		clientId: "foo",
	});
	const message = await getMessage(app, "ws://localhost:31000");
	const dispose = () => {
		message.close();
	};
	return { app, message, dispose };
}

async function serveOneRequest(listener: Deno.Listener, server: Server) {
	const conn = await listener.accept();
	const httpConn = Deno.serveHttp(conn);
	const event = await httpConn.nextRequest();
	assertExists(event);
	const { respondWith, request } = event!;

	const [response] = await server.handleRequest(request);
	await respondWith(response);
	httpConn.close();
}

Deno.test("join channel", async () => {
	const builder = new MessageBuilder();
	builder.permission(MessagePermissions.Connect);
	builder.channel("/chat/:chatId").permission(ChannelPermissions.Join);
	const { server, dispose: disposeServer, publicKey } = await setupServer({ messageDescriptor: builder.build() });
	const { message, dispose: disposeApp } = await setupApp(server, publicKey);

	const listener = Deno.listen({ port: 31000 });

	const result = join(message, channel("/chat/abc"), (msg) => {});
	await serveOneRequest(listener, server);
	const { leave, publish } = await result;
	debugger;

	await disposeApp();
	await disposeServer();
	listener.close();
	await new Promise((r) => setTimeout(r, 100));
});

Deno.test("send message to channel", async () => {
	const builder = new MessageBuilder();
	builder.permission(MessagePermissions.Connect);
	builder
		.channel("/chat/:chatId")
		.permission(ChannelPermissions.Join | ChannelPermissions.Send)
		// deno-lint-ignore require-await
		.onMessage(async (_ctx, chan, _from, msg) => {
			for (const participant of chan.participants) {
				participant.send(msg);
			}
		});
	const { server, dispose: disposeServer, publicKey } = await setupServer({ messageDescriptor: builder.build() });
	const { message, dispose: disposeApp } = await setupApp(server, publicKey);

	const listener = Deno.listen({ port: 31000 });

	let receivedMsg = false;
	const result = join(message, channel("/chat/abc"), (msg) => {
		receivedMsg = msg.type === "message" && msg.data === "foo";
	});
	await serveOneRequest(listener, server);
	const { leave, publish } = await result;

	await publish("foo");
	await new Promise((r) => setTimeout(r, 1000));
	assertEquals(receivedMsg, true);

	await disposeApp();
	await disposeServer();
	listener.close();
	await new Promise((r) => setTimeout(r, 100));
});
