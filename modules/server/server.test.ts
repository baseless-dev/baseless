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
import { Deferred } from "https://baseless.dev/x/client/utils.ts";
import { Server } from "./server.ts";
import { DenoMessageHub } from "https://baseless.dev/x/provider-message-deno/mod.ts";

async function setupServer(
	authDescriptor: AuthDescriptor = auth.build(),
	databaseDescriptor: DatabaseDescriptor = database.build(),
	functionsDescriptor: FunctionsDescriptor = functions.build(),
	mailDescriptor: MailDescriptor = mail.build(),
	messageDescriptor: MessageDescriptor = message.build(),
) {
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

	return { server, dispose };
}

Deno.test("request without Baseless client header returns 401", async () => {
	const { server, dispose } = await setupServer();
	const request = new Request("http://test.local/", { method: "OPTIONS" });
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 401);
	await dispose();
});

Deno.test("request with invalid Baseless client header returns 401", async () => {
	const { server, dispose } = await setupServer();
	const request = new Request("http://test.local/", {
		method: "OPTIONS",
		headers: { "X-BASELESS-CLIENT-ID": "unknown" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 401);

	await dispose();
});

Deno.test("request without Origin returns 401", async () => {
	const { server, dispose } = await setupServer();

	const request = new Request("http://test.local/", {
		method: "OPTIONS",
		headers: { "X-BASELESS-CLIENT-ID": "foo" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 401);

	await dispose();
});

Deno.test("request with invalid Origin returns 401", async () => {
	const { server, dispose } = await setupServer();

	const request = new Request("http://test.local/", {
		method: "OPTIONS",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://test.local/" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 401);

	await dispose();
});

Deno.test("request with valid Client and Origin returns 200", async () => {
	const { server, dispose } = await setupServer();
	const request = new Request("http://test.local/", {
		method: "OPTIONS",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 200);

	await dispose();
});

Deno.test("request with pathname trigger unknown function returns 405", async () => {
	const { server, dispose } = await setupServer();
	const request = new Request("http://test.local/fn/test", {
		method: "GET",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 405);

	await dispose();
});

Deno.test("request with pathname trigger function", async () => {
	const fnBuilder = new FunctionsBuilder();
	fnBuilder.http("test").onCall(() => Promise.resolve(new Response(null, { status: 418 })));
	const { server, dispose } = await setupServer(undefined, undefined, fnBuilder.build());
	const request = new Request("http://test.local/test", {
		method: "GET",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 418);

	await dispose();
});

Deno.test("request with pathname trigger function that throws returns 500", async () => {
	const fnBuilder = new FunctionsBuilder();
	fnBuilder.http("test").onCall(() => {
		throw new Error("Log me!");
	});
	const { server, dispose } = await setupServer(undefined, undefined, fnBuilder.build());
	const request = new Request("http://test.local/test", {
		method: "GET",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 500);

	await dispose();
});

Deno.test("request with unknown Content-Type returns 400", async () => {
	const { server, dispose } = await setupServer();
	const request = new Request("http://test.local/", {
		method: "GET",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org", "Content-Type": "text/foobar" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 400);

	await dispose();
});

Deno.test("request with malformed JSON returns 400", async () => {
	const { server, dispose } = await setupServer();
	const request = new Request("http://test.local/", {
		method: "POST",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org", "Content-Type": "text/foobar" },
		body: '{"malformed": "JSON"',
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 400);

	await dispose();
});

Deno.test("request with payload that is not a list of Commands returns 400", async () => {
	const { server, dispose } = await setupServer();
	{ // Clearly not a command
		const request = new Request("http://test.local/", {
			method: "POST",
			headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org", "Content-Type": "text/foobar" },
			body: '{"not a command": "foobar"}',
		});
		const [response] = await server.handleRequest(request);
		assertEquals(response.status, 400);
	}
	{ // Invalid command
		const request = new Request("http://test.local/", {
			method: "POST",
			headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org", "Content-Type": "application/json" },
			body: '{"1": {"cmd": "foobar"}}',
		});
		const [response] = await server.handleRequest(request);
		assertEquals(response.status, 400);
	}
	await dispose();
});

Deno.test("request with commands returns 200", async () => {
	const { server, dispose } = await setupServer();
	const request = new Request("http://test.local/", {
		method: "POST",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org", "Content-Type": "application/json" },
		body: '{"1": {"cmd": "auth.signin-anonymously"}}',
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 200);
	await dispose();
});

Deno.test("request with unknown authorization returns 200", async () => {
	const { server, dispose } = await setupServer();
	const request = new Request("http://test.local/", {
		method: "OPTIONS",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org", "Authorization": "Foo Bar" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 200);
	await dispose();
});

Deno.test("request with invalid access token returns 200", async () => {
	const { server, dispose } = await setupServer();
	const request = new Request("http://test.local/", {
		method: "OPTIONS",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org", "Authorization": "Bearer malformed" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 200);
	await dispose();
});

async function assertOnMessage(websocket: WebSocket, message?: string, timeout = 2 * 1000): Promise<void> {
	const msg = await getOneMessage(websocket, timeout);
	if (message) {
		assertEquals(msg, message, `Expected ${message}, got ${msg}.`);
	}
}

function getOneMessage(websocket: WebSocket, timeout = 2 * 1000): Promise<string> {
	const defer = new Deferred<string>();

	const timer = setTimeout(() => {
		assertEquals(true, false, `Expected a message, timeout reached.`);
		defer.reject();
	}, timeout);
	defer.promise.finally(() => {
		websocket.onmessage = null;
		clearTimeout(timer);
	});

	websocket.onmessage = (event) => defer.resolve(event.data);

	return defer.promise;
}

function assertOnClose(websocket: WebSocket, timeout = 2 * 1000): Promise<void> {
	const defer = new Deferred<void>();

	const timer = setTimeout(() => defer.reject(), timeout);
	defer.promise.finally(() => {
		websocket.onclose = null;
		clearTimeout(timer);
	});

	websocket.onclose = () => defer.resolve();

	return defer.promise;
}

Deno.test("request upgrade websocket with missing client_id param returns 401", async () => {
	const { server, dispose } = await setupServer();
	const listener = Deno.listen({ port: 31000 });
	const accepting = listener.accept();
	const ws = new WebSocket("ws://127.0.0.1:31000/");
	{
		const conn = await accepting;
		const httpConn = Deno.serveHttp(conn);
		const event = await httpConn.nextRequest();
		assertExists(event);
		const { respondWith, request } = event!;

		const [response] = await server.handleRequest(request);
		assertEquals(response.status, 401);
		await respondWith(response);
		httpConn.close();
	}

	assertEquals(ws.readyState, ws.CLOSED);

	ws.close();
	listener.close();
	await dispose();
});

Deno.test("request upgrade websocket with unknown client_id param returns 401", async () => {
	const { server, dispose } = await setupServer();
	const listener = Deno.listen({ port: 31000 });
	const accepting = listener.accept();
	const ws = new WebSocket("ws://127.0.0.1:31000/?client_id=bar");
	{
		const conn = await accepting;
		const httpConn = Deno.serveHttp(conn);
		const event = await httpConn.nextRequest();
		assertExists(event);
		const { respondWith, request } = event!;

		const [response] = await server.handleRequest(request);
		assertEquals(response.status, 401);
		await respondWith(response);
		httpConn.close();
	}

	assertEquals(ws.readyState, ws.CLOSED);

	ws.close();
	listener.close();
	await dispose();
});

Deno.test("websocket with message permission none returns 401", async () => {
	const { server, dispose } = await setupServer();
	const listener = Deno.listen({ port: 31000 });
	const accepting = listener.accept();
	const ws = new WebSocket("ws://127.0.0.1:31000/?client_id=foo");
	{
		const conn = await accepting;
		const httpConn = Deno.serveHttp(conn);
		const event = await httpConn.nextRequest();
		assertExists(event);
		const { respondWith, request } = event!;

		const [response] = await server.handleRequest(request);
		assertEquals(response.status, 401);
		await respondWith(response);
		httpConn.close();
	}

	assertEquals(ws.readyState, ws.CLOSED);

	listener.close();
	await dispose();
});

Deno.test("websocket with message permission connect returns 101", async () => {
	const msgBuilder = new MessageBuilder().permission(MessagePermissions.Connect);
	const { server, dispose } = await setupServer(undefined, undefined, undefined, undefined, msgBuilder.build());
	const listener = Deno.listen({ port: 31000 });
	const accepting = listener.accept();
	const ws = new WebSocket("ws://127.0.0.1:31000/?client_id=foo");
	{
		const conn = await accepting;
		const httpConn = Deno.serveHttp(conn);
		const event = await httpConn.nextRequest();
		assertExists(event);
		const { respondWith, request } = event!;

		const [response] = await server.handleRequest(request);
		assertEquals(response.status, 101);
		await respondWith(response);
		httpConn.close();
	}

	assertEquals(ws.readyState, ws.OPEN);
	const data = await getOneMessage(ws);
	const msg = JSON.parse(data);
	assertExists(msg.session);
	assertExists(msg.session.id);

	ws.close();
	await assertOnClose(ws);
	listener.close();
	await dispose();
});

Deno.test("websocket joins unknown channel returns ChannelNotFoundError", async () => {
	const msgBuilder = new MessageBuilder().permission(MessagePermissions.Connect);
	const { server, dispose } = await setupServer(undefined, undefined, undefined, undefined, msgBuilder.build());
	const listener = Deno.listen({ port: 31000 });
	const accepting = listener.accept();
	const ws = new WebSocket("ws://127.0.0.1:31000/?client_id=foo");
	{
		const conn = await accepting;
		const httpConn = Deno.serveHttp(conn);
		const event = await httpConn.nextRequest();
		assertExists(event);
		const { respondWith, request } = event!;

		const [response] = await server.handleRequest(request);
		assertEquals(response.status, 101);
		await respondWith(response);
		httpConn.close();
	}

	assertEquals(ws.readyState, ws.OPEN);
	await getOneMessage(ws);

	ws.send(JSON.stringify({ id: "1", type: "chan.join", ref: "/chat/abc" }));
	await assertOnMessage(ws, JSON.stringify({ id: "1", error: "ChannelNotFoundError" }));

	await new Promise((r) => setTimeout(r, 100));

	ws.close();
	await assertOnClose(ws);
	listener.close();
	await dispose();
});

Deno.test("websocket joins channel without join permission returns ChannelPermissionRequired", async () => {
	const msgBuilder = new MessageBuilder().permission(MessagePermissions.Connect);
	msgBuilder.channel("/chat/:chatId").permission(ChannelPermissions.None);
	const { server, dispose } = await setupServer(undefined, undefined, undefined, undefined, msgBuilder.build());
	const listener = Deno.listen({ port: 31000 });
	const accepting = listener.accept();
	const ws = new WebSocket("ws://127.0.0.1:31000/?client_id=foo");
	{
		const conn = await accepting;
		const httpConn = Deno.serveHttp(conn);
		const event = await httpConn.nextRequest();
		assertExists(event);
		const { respondWith, request } = event!;

		const [response] = await server.handleRequest(request);
		assertEquals(response.status, 101);
		await respondWith(response);
		httpConn.close();
	}

	assertEquals(ws.readyState, ws.OPEN);
	await getOneMessage(ws);

	ws.send(JSON.stringify({ id: "1", type: "chan.join", ref: "/chat/abc" }));
	await assertOnMessage(ws, JSON.stringify({ id: "1", error: "ChannelPermissionRequired" }));

	await new Promise((r) => setTimeout(r, 100));

	ws.close();
	await assertOnClose(ws);
	listener.close();
	await dispose();
});

Deno.test("websocket send message to channel without send permission returns ChannelPermissionRequired", async () => {
	const msgBuilder = new MessageBuilder().permission(MessagePermissions.Connect);
	msgBuilder.channel("/chat/:chatId").permission(ChannelPermissions.Join);
	const { server, dispose } = await setupServer(undefined, undefined, undefined, undefined, msgBuilder.build());
	const listener = Deno.listen({ port: 31000 });
	const accepting = listener.accept();
	const ws = new WebSocket("ws://127.0.0.1:31000/?client_id=foo");
	{
		const conn = await accepting;
		const httpConn = Deno.serveHttp(conn);
		const event = await httpConn.nextRequest();
		assertExists(event);
		const { respondWith, request } = event!;

		const [response] = await server.handleRequest(request);
		assertEquals(response.status, 101);
		await respondWith(response);
		httpConn.close();
	}

	assertEquals(ws.readyState, ws.OPEN);
	await getOneMessage(ws);

	ws.send(JSON.stringify({ id: "1", type: "chan.join", ref: "/chat/abc" }));
	await assertOnMessage(ws, JSON.stringify({ id: "1" }));
	ws.send(JSON.stringify({ id: "2", type: "chan.send", ref: "/chat/abc", message: "foo" }));
	await assertOnMessage(ws, JSON.stringify({ id: "2", error: "ChannelPermissionRequired" }));

	await new Promise((r) => setTimeout(r, 100));

	ws.close();
	await assertOnClose(ws);
	listener.close();
	await dispose();
});

Deno.test("websocket send message to channel broadcast back message", async () => {
	const msgBuilder = new MessageBuilder().permission(MessagePermissions.Connect);
	msgBuilder
		.channel("/chat/:chatId")
		.permission(ChannelPermissions.Join | ChannelPermissions.Send)
		// deno-lint-ignore require-await
		.onMessage(async (_ctx, chan, _from, msg, { chatId }) => {
			for (const participant of chan.participants) {
				participant.session.socket.send(msg);
			}
		});
	const { server, dispose } = await setupServer(undefined, undefined, undefined, undefined, msgBuilder.build());
	const listener = Deno.listen({ port: 31000 });
	const ws1 = new WebSocket("ws://127.0.0.1:31000/?client_id=foo");
	{
		const conn = await listener.accept();
		const httpConn = Deno.serveHttp(conn);
		const event = await httpConn.nextRequest();
		assertExists(event);
		const { respondWith, request } = event!;

		const [response] = await server.handleRequest(request);
		assertEquals(response.status, 101);
		await respondWith(response);
		httpConn.close();
	}

	assertEquals(ws1.readyState, ws1.OPEN);
	await getOneMessage(ws1);

	const ws2 = new WebSocket("ws://127.0.0.1:31000/?client_id=foo");
	{
		const conn = await listener.accept();
		const httpConn = Deno.serveHttp(conn);
		const event = await httpConn.nextRequest();
		assertExists(event);
		const { respondWith, request } = event!;

		const [response] = await server.handleRequest(request);
		assertEquals(response.status, 101);
		await respondWith(response);
		httpConn.close();
	}

	assertEquals(ws2.readyState, ws2.OPEN);
	await getOneMessage(ws2);

	ws1.send(JSON.stringify({ id: "1", type: "chan.join", ref: "/chat/abc" }));
	await assertOnMessage(ws1, JSON.stringify({ id: "1" }));
	ws2.send(JSON.stringify({ id: "2", type: "chan.join", ref: "/chat/abc" }));
	await assertOnMessage(ws2, JSON.stringify({ id: "2" }));
	ws1.send(JSON.stringify({ id: "3", type: "chan.send", ref: "/chat/abc", message: "foo" }));
	await Promise.all([
		assertOnMessage(ws1, JSON.stringify({ id: "3" })),
		assertOnMessage(ws2, "foo"),
	]);
	await assertOnMessage(ws1, "foo");

	await new Promise((r) => setTimeout(r, 100));

	ws1.close();
	ws2.close();
	await assertOnClose(ws1);
	await assertOnClose(ws2);
	listener.close();
	await dispose();
});
