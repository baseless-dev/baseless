import * as App from "../app.ts";
import * as Type from "@baseless/core/schema";
import { assertEquals } from "@std/assert/equals";
import createMemoryServer, { connect, pubsub, serve } from "../server.test.ts";

Deno.test("PubSub application", async (t) => {
	const messages: Array<string> = [];
	using mock = await createMemoryServer({
		topicPing: App.topic("ping", Type.String(), () => App.Permission.All),
		onPing: App.onTopicMessage("ping", ({ message }) => {
			messages.push(message.data);
		}),
	});

	await t.step("publish and onTopicMessage", async () => {
		using stream = pubsub(mock);
		await mock.post("/pubsub/publish", { data: { key: "ping", payload: "from request" } });
		await stream.next();
		assertEquals(messages, ["from request"]);
	});

	await t.step("connect, subscribe and publish", async () => {
		using server = await serve(mock.server);
		const url = new URL(server.url);
		url.protocol = "ws";
		using ws = connect(url, ["bls"]);
		using stream = pubsub(mock);

		assertEquals(await ws.readyState(), WebSocket.OPEN);

		await ws.send(JSON.stringify({ type: "subscribe", key: "ping" }));

		{
			await ws.send(JSON.stringify({ type: "publish", key: "ping", payload: "from websocket" }));
			await stream.next();
			const { data } = await ws.message();
			assertEquals(data, JSON.stringify({ key: "ping", payload: "from websocket" }));
		}
	});
});
