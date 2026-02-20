import { app, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import { assertEquals } from "@std/assert/equals";
import pubsubApp from "./pubsub.ts";
import createMemoryServer, { connect, pubsub, serve } from "../server.test.ts";

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
		await mock.fetch("/core/pubsub/publish", { data: { key: "ping", payload: "from request" } });
		await stream.next();
		assertEquals(messages, ["from request"]);
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
			await mock.fetch("/core/pubsub/publish", { data: { key: "ping", payload: "from request" } });
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
});
