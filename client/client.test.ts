import { collection, Identity, onRequest, onTopicMessage, Permission, topic, Type } from "@baseless/server";
import { pubsub, sleep } from "../server/server.test.ts";
import { assertEquals } from "@std/assert/equals";
import { AuthenticationResponse } from "@baseless/core/authentication-response";
import { assert } from "@std/assert/assert";
import { AuthenticationTokens } from "@baseless/core/authentication-tokens";
import { assertRejects } from "@std/assert/rejects";
import createMemoryClientServer from "./internal.test.ts";

Deno.test("Client", async (ctx) => {
	const pings: string[] = [];
	const app = {
		hello: onRequest(
			"hello",
			Type.String(),
			Type.String(),
			({ input, auth }) => `Hello ${input} (from ${auth?.identityId ?? "anonymous"})`,
			() => Permission.All,
		),
		posts: collection("post", Type.String(), Type.String(), () => Permission.All),
		ping: topic("ping", Type.String(), () => Permission.All),
		onPing: onTopicMessage("ping", ({ message }) => {
			pings.push(message.data);
		}),
	};
	await ctx.step("basic request", async () => {
		await using mock = await createMemoryClientServer(app);
		const { client } = mock;
		const result = await client.fetch("hello", "World");
		assertEquals(result, "Hello World (from anonymous)");
	});

	await ctx.step("authenticate", async () => {
		const changes: Array<Identity | undefined> = [];
		await using mock = await createMemoryClientServer(app);
		const { client, identity } = mock;
		client.onAuthenticationStateChange((identity) => {
			changes.push(identity);
		});
		const begin = await client.fetch("auth/begin", { kind: "authentication", scopes: ["firstName"] });
		Type.assert(AuthenticationResponse, begin);
		assert("state" in begin);
		const email = await client.fetch("auth/submit-prompt", { id: "email", value: "foo@test.local", state: begin.state });
		Type.assert(AuthenticationResponse, email);
		assert("state" in email);
		const password = await client.fetch("auth/submit-prompt", { id: "password", value: "lepassword", state: email.state });
		Type.assert(AuthenticationTokens, password);
		assert(client.identity);
		assertEquals(client.identity, { id: identity.id, data: { firstName: identity.data!.firstName } });
		assertEquals(changes.length, 1);
		assertEquals(changes[0], { id: identity.id, data: { firstName: identity.data!.firstName } });
		const result = await client.fetch("hello", "World");
		assertEquals(result, `Hello World (from ${identity.id})`);
	});

	await ctx.step("get document", async () => {
		await using mock = await createMemoryClientServer(app);
		const { client } = mock;
		const result = await client.document.get("post/a");
		assertEquals(result.data, "A");
	});

	await ctx.step("get many documents", async () => {
		await using mock = await createMemoryClientServer(app);
		const { client } = mock;
		const result = await client.document.getMany(["post/a", "post/c"]);
		assertEquals(result.length, 2);
		assertEquals(result[0].data, "A");
		assertEquals(result[1].data, "C");
	});

	await ctx.step("list documents", async () => {
		await using mock = await createMemoryClientServer(app);
		const { client } = mock;
		const result = await Array.fromAsync(client.document.list({ prefix: "post", limit: 2 }));
		assertEquals(result.length, 2);
		assertEquals(result[0].document.data, "A");
		assertEquals(result[1].document.data, "B");
	});

	await ctx.step("document atomic", async () => {
		await using mock = await createMemoryClientServer(app);
		const { client } = mock;
		await client.document.atomic()
			.check("post/d", null)
			.set("post/d", "D")
			.commit();
		const result = await client.document.get("post/d");
		assertEquals(result.data, "D");

		await assertRejects(() =>
			client.document.atomic()
				.check("post/d", null)
				.set("post/d", "D")
				.commit()
		);
	});

	await ctx.step("pubsub subscribe & publish", async () => {
		await using mock = await createMemoryClientServer(app, true);
		const { client } = mock;

		using queueStream = pubsub(mock);
		await client.pubsub.publish("ping", "from client");
		await queueStream.next();
		assert(pings.length === 1);

		const subscription = client.pubsub.subscribe("ping");
		const reader = subscription.getReader();

		await client.pubsub.publish("ping", "from client");
		await sleep(200);
		await queueStream.next();
		await sleep(200);
		assertEquals(await reader.read(), { done: false, value: "from client" });

		reader.releaseLock();
		await subscription.cancel();
	});
});
