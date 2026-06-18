import { app, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import { ForbiddenError } from "@baseless/core/errors";
import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import type { ID } from "@baseless/core/id";
import pubsubApp from "./pubsub.ts";
import createMemoryServer, { connect, deadline, pubsub, serve, sleep } from "../server.test.ts";

Deno.test("PubSub application", async (t) => {
	const messages: Array<string> = [];
	using mock = await createMemoryServer({
		app: app()
			.extend(pubsubApp)
			.topic({
				path: "ping",
				schema: z.string(),
				security: () => Permission.All,
			})
			.onTopicMessage({
				path: "ping",
				handler: ({ message }) => {
					messages.push(message.data);
				},
			})
			.build(),
		configuration: {},
	});

	await t.step("publish and onTopicMessage", async () => {
		await using stream = pubsub(mock);
		await mock.fetch("/pubsub/publish", { data: { key: "ping", payload: "from request" } });
		await stream.next();
		assertEquals(messages, ["from request"]);
	});

	await t.step("publish denied when security lacks Publish permission returns ForbiddenError", async () => {
		using mockDenied = await createMemoryServer({
			app: app()
				.extend(pubsubApp)
				.topic({
					path: "restricted",
					schema: z.string(),
					security: () => Permission.Subscribe,
				})
				.build(),
			configuration: {},
		});

		await assertRejects(
			() => mockDenied.fetch("/pubsub/publish", { data: { key: "restricted", payload: "should be denied" } }),
			ForbiddenError,
		);
	});

	await t.step("connect, subscribe and publish", async () => {
		using server = await serve(mock.server);
		const url = new URL(server.url);
		url.protocol = "ws";
		using ws = connect(url, ["bls"]);
		await using stream = pubsub(mock);

		assertEquals(await ws.readyState(), WebSocket.OPEN);

		await ws.send(JSON.stringify({ type: "subscribe", key: "ping" }));

		{
			await mock.fetch("/pubsub/publish", { data: { key: "ping", payload: "from request" } });
			await stream.next();
			const { data } = await ws.message();
			assertEquals(data, JSON.stringify({ key: "ping", payload: "from request" }));
		}
		{
			await ws.send(JSON.stringify({ type: "publish", key: "ping", payload: "from websocket" }));
			await stream.next();
			const { data } = await ws.message();
			assertEquals(data, JSON.stringify({ key: "ping", payload: "from websocket" }));
		}
	});

	await t.step("onHubConnect and onHubDisconnect fire on connect and close", async () => {
		const connectEvents: Array<ID<"hub_">> = [];
		const disconnectEvents: Array<ID<"hub_">> = [];

		using server2 = await createMemoryServer({
			app: app()
				.extend(pubsubApp)
				.onHubConnect({
					handler: ({ hubId }) => {
						connectEvents.push(hubId);
					},
				})
				.onHubDisconnect({
					handler: ({ hubId }) => {
						disconnectEvents.push(hubId);
					},
				})
				.build(),
			configuration: {},
		});

		using denoServer = await serve(server2.server);
		const url = new URL(denoServer.url);
		url.protocol = "ws";
		using ws2 = connect(url, ["bls"]);

		assertEquals(await ws2.readyState(), WebSocket.OPEN);

		// Wait for connect hook to fire (bounded retry)
		for (let i = 0; i < 20 && connectEvents.length === 0; i++) {
			await new Promise((r) => setTimeout(r, 10));
		}
		assertEquals(connectEvents.length, 1);

		ws2.close();
		// Wait for disconnect hook to fire (bounded retry)
		for (let i = 0; i < 20 && disconnectEvents.length === 0; i++) {
			await new Promise((r) => setTimeout(r, 10));
		}
		assertEquals(disconnectEvents.length, 1);
		assertEquals(connectEvents[0], disconnectEvents[0]);
	});

	await t.step("unsubscribe stops delivery", async () => {
		using server = await serve(mock.server);
		const url = new URL(server.url);
		url.protocol = "ws";
		using ws = connect(url, ["bls"]);
		await using stream = pubsub(mock);
		using _dl = deadline(5000);

		assertEquals(await ws.readyState(), WebSocket.OPEN);

		// Subscribe, confirm delivery works
		await ws.send(JSON.stringify({ type: "subscribe", key: "ping" }));
		await mock.fetch("/pubsub/publish", { data: { key: "ping", payload: "before-unsub" } });
		await stream.next();
		const { data: beforeData } = await ws.message();
		assertEquals(beforeData, JSON.stringify({ key: "ping", payload: "before-unsub" }));

		// Unsubscribe
		await ws.send(JSON.stringify({ type: "unsubscribe", key: "ping" }));
		// Give the server time to process the unsubscribe message
		await sleep(100);

		// Publish a sentinel — if the client receives it, the unsubscribe failed.
		// Publish a SECOND known message right after; we expect only the sentinel to be
		// detectable by the still-subscribed path. Since the client is now unsubscribed,
		// the sentinel must NOT arrive. We verify by re-subscribing and confirming
		// a subsequent message IS delivered (proving the channel still works).
		await mock.fetch("/pubsub/publish", { data: { key: "ping", payload: "after-unsub" } });
		await stream.next();

		// Re-subscribe and publish a known sentinel
		await ws.send(JSON.stringify({ type: "subscribe", key: "ping" }));
		await mock.fetch("/pubsub/publish", { data: { key: "ping", payload: "sentinel" } });
		await stream.next();
		const { data: sentinelData } = await ws.message();
		// The first message we receive after re-subscribing must be the sentinel,
		// not "after-unsub". This proves "after-unsub" was not delivered.
		assertEquals(sentinelData, JSON.stringify({ key: "ping", payload: "sentinel" }));
	});

	await t.step("closing socket removes it from hub (publish after close does not deliver)", async () => {
		using server = await serve(mock.server);
		const url = new URL(server.url);
		url.protocol = "ws";
		using _dl = deadline(5000);

		// Two clients subscribe to "ping"
		using ws1 = connect(url, ["bls"]);
		using ws2 = connect(url, ["bls"]);
		await using stream = pubsub(mock);

		assertEquals(await ws1.readyState(), WebSocket.OPEN);
		assertEquals(await ws2.readyState(), WebSocket.OPEN);

		await ws1.send(JSON.stringify({ type: "subscribe", key: "ping" }));
		await ws2.send(JSON.stringify({ type: "subscribe", key: "ping" }));
		await sleep(100);

		// Confirm both receive a message before closing ws1
		await mock.fetch("/pubsub/publish", { data: { key: "ping", payload: "before-close" } });
		await stream.next();
		const { data: d1 } = await ws1.message();
		const { data: d2 } = await ws2.message();
		assertEquals(d1, JSON.stringify({ key: "ping", payload: "before-close" }));
		assertEquals(d2, JSON.stringify({ key: "ping", payload: "before-close" }));

		// Close ws1
		ws1.close();
		assertEquals(await ws1.readyState(), WebSocket.CLOSED);
		await sleep(100);

		// Publish after ws1 is closed — must not throw and must not deliver to ws1
		// ws2 (still open and subscribed) must still receive
		await mock.fetch("/pubsub/publish", { data: { key: "ping", payload: "after-close" } });
		await stream.next();
		const { data: d2After } = await ws2.message();
		assertEquals(d2After, JSON.stringify({ key: "ping", payload: "after-close" }));
		// ws1 is closed; no assertion on ws1.message() to avoid hanging on a dead socket
	});

	await t.step("two concurrent subscribers both receive published message", async () => {
		using server = await serve(mock.server);
		const url = new URL(server.url);
		url.protocol = "ws";
		using _dl = deadline(5000);

		using wsA = connect(url, ["bls"]);
		using wsB = connect(url, ["bls"]);
		await using stream = pubsub(mock);

		assertEquals(await wsA.readyState(), WebSocket.OPEN);
		assertEquals(await wsB.readyState(), WebSocket.OPEN);

		await wsA.send(JSON.stringify({ type: "subscribe", key: "ping" }));
		await wsB.send(JSON.stringify({ type: "subscribe", key: "ping" }));
		await sleep(100);

		await mock.fetch("/pubsub/publish", { data: { key: "ping", payload: "broadcast" } });
		await stream.next();

		const [{ data: dataA }, { data: dataB }] = await Promise.all([wsA.message(), wsB.message()]);
		assertEquals(dataA, JSON.stringify({ key: "ping", payload: "broadcast" }));
		assertEquals(dataB, JSON.stringify({ key: "ping", payload: "broadcast" }));
	});
});
