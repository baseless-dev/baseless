import { assertEquals, assertExists } from "https://deno.land/std@0.118.0/testing/asserts.ts";
import { Deferred } from "https://baseless.dev/x/client/utils.ts";
import { MemoryMessageProvider } from "./mod.ts";
import { ChannelReference } from "https://baseless.dev/x/shared/message.ts";

function assertOnMessage(websocket: WebSocket, message?: string, timeout = 2 * 1000): Promise<void> {
	const defer = new Deferred<void>();

	const timer = setTimeout(() => defer.reject(), timeout);
	defer.promise.finally(() => {
		websocket.onmessage = null;
		clearTimeout(timer);
	});

	websocket.onmessage = (event) => {
		if (!message || event.data === message) {
			defer.resolve();
		}
	};

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

Deno.test("Deno.listen+Deno.serveHttp", async () => {
	const server = Deno.listen({ port: 31000 });

	const accepting = server.accept();
	const fetching = fetch("http://127.0.0.1:31000/");
	const conn = await accepting;
	const httpConn = Deno.serveHttp(conn);
	const event = await httpConn.nextRequest();
	assertExists(event);
	const { respondWith } = event!;
	await respondWith(new Response(null, { status: 501 }));
	httpConn.close();

	const response = await fetching;
	assertEquals(response.status, 501);
	const _text = await response.text();

	server.close();
});

Deno.test("Deno.listen+Deno.upgradeWebSocket", async () => {
	const server = Deno.listen({ port: 31000 });

	const accepting = server.accept();
	const wsClient = new WebSocket("ws://127.0.0.1:31000/");
	const conn = await accepting;
	const httpConn = Deno.serveHttp(conn);
	const event = await httpConn.nextRequest();
	assertExists(event);
	const { request, respondWith } = event!;
	const upgrade = Deno.upgradeWebSocket(request);
	const wsServer = upgrade.socket;
	await respondWith(upgrade.response);
	httpConn.close();

	wsClient.send("ping");
	await assertOnMessage(wsServer, "ping");
	wsServer.send("pong");
	await assertOnMessage(wsClient, "pong");

	wsClient.close();
	wsServer.close();
	server.close();

	await Promise.all([
		assertOnClose(wsClient, 10),
		assertOnClose(wsServer, 10),
	]);
});

Deno.test("Channel", async () => {
	const provider = new MemoryMessageProvider();
	const channel = await provider.createChannel(new ChannelReference("/rooms/abc"), {});

	const server = Deno.listen({ port: 31000 });

	const accepting = server.accept();
	const wsClient1 = new WebSocket("ws://127.0.0.1:31000/");
	const wsClient2 = new WebSocket("ws://127.0.0.1:31000/");
	{
		const conn = await accepting;
		const httpConn = Deno.serveHttp(conn);
		const event = await httpConn.nextRequest();
		assertExists(event);
		const { request, respondWith } = event!;
		const response = await channel.forward(request);
		await respondWith(response);
		httpConn.close();
	}
	{
		const conn = await server.accept();
		const httpConn = Deno.serveHttp(conn);
		const event = await httpConn.nextRequest();
		assertExists(event);
		const { request, respondWith } = event!;
		const response = await channel.forward(request);
		await respondWith(response);
		httpConn.close();
	}

	assertEquals(channel.participants.size, 2);

	await channel.broadcast("ping");

	await Promise.all([
		assertOnMessage(wsClient1, "ping"),
		assertOnMessage(wsClient2, "ping"),
	]);

	wsClient1.close();
	wsClient2.close();
	server.close();

	await Promise.all([
		assertOnClose(wsClient1, 10),
		assertOnClose(wsClient2, 10),
	]);
});
