import { app, Permission } from "@baseless/server";
import docApp from "@baseless/server/apps/document";
import pubsubApp from "@baseless/server/apps/pubsub";
import storageApp from "@baseless/server/apps/storage";
import tableApp from "@baseless/server/apps/table";
import authApp from "@baseless/server/apps/authentication";
import { Client } from "./client.ts";
import { generateKeyPair } from "jose/key/generate/keypair";
import createMemoryServer, { pubsub, serve, sleep } from "../server/server.test.ts";
import * as z from "@baseless/core/schema";
import { Response } from "@baseless/core/response";
import { ref } from "@baseless/core/ref";
import { id, ksuid } from "@baseless/core/id";
import { assert } from "@std/assert/assert";
import { assertEquals } from "@std/assert/equals";
import { assertExists } from "@std/assert/exists";
import { assertObjectMatch } from "@std/assert/object-match";
import { assertRejects } from "@std/assert/rejects";
import { StorageObjectNotFoundError } from "@baseless/core/errors";
import { EmailIdentityComponentProvider } from "@baseless/server/auth/email";
import { PasswordIdentityComponentProvider } from "@baseless/server/auth/password";
import { component, sequence } from "@baseless/core/authentication-ceremony";
import { AuthenticationTokensObject } from "@baseless/core/authentication-tokens";

Deno.test("Client", async (ctx) => {
	const keyPair = await generateKeyPair("PS512");

	const testApp = app()
		.extend(authApp)
		.extend(docApp)
		.extend(pubsubApp)
		.extend(storageApp)
		.extend(tableApp)
		.endpoint({
			path: `hello`,
			request: z.request(),
			response: z.textResponse(),
			handler: () => {
				return Response.text(`Hello World`);
			},
		})
		.endpoint({
			path: `hello-world`,
			request: z.textRequest(),
			response: z.textResponse(),
			handler: ({ request }) => {
				return Response.text(`Hello ${request.body}`);
			},
		})
		.collection({
			path: `posts`,
			schema: z.object({ postId: z.id("p_"), title: z.string() }),
			collectionSecurity: () => Permission.All,
			documentSecurity: () => Permission.All,
			topicSecurity: () => Permission.All,
		})
		.document({
			path: `users/:userid/preferences`,
			schema: z.object({
				foo: z.optional(z.boolean()),
				bar: z.optional(z.string()),
			}),
			documentSecurity: () => Permission.All,
			topicSecurity: () => Permission.All,
		})
		.table({
			path: "users",
			schema: z.object({ id: z.string() }),
			tableSecurity: () => Permission.All,
			rowSecurity: ({ q, auth }) => q.equal(q.ref("users", "id"), q.literal(auth?.identityId ?? "")),
		})
		.file({
			path: `avatar`,
			fileSecurity: () => Permission.All,
		})
		.folder({
			path: `uploads`,
			folderSecurity: () => Permission.All,
			fileSecurity: () => Permission.All,
		})
		.topic({
			path: `presence`,
			schema: z.object({ userId: z.id("u_") }),
			security: () => Permission.All,
		})
		.build();

	const email = new EmailIdentityComponentProvider({
		sendValidationNotification: ({ code }) => {
			return {
				subject: "Your verification code",
				content: {
					"text/x-code": `${code}`,
				},
			};
		},
	});
	const password = new PasswordIdentityComponentProvider("dummy salt");
	await using mock = await createMemoryServer({
		app: testApp,
		configuration: {
			auth: {
				accessTokenTTL: 5 * 60 * 1_000,
				authenticationTTL: 5 * 60 * 1_000,
				ceremony: sequence(component("email"), component("password")),
				components: { email, password },
				keyAlgo: "PS512",
				keyPrivate: keyPair.privateKey,
				keyPublic: keyPair.publicKey,
				keySecret: new TextEncoder().encode("2kkAiCQTWisiQOe0SdrppLTW9B8Uxe3n74Ij2BkN4tNrItFRelNt7QWe3kI2NiBs"),
				rateLimit: { limit: 5, period: 5 * 60 * 1_000 },
				refreshTokenTTL: 10 * 60 * 1_000,
			},
		},
	});

	// Create the table used by the table test step
	await mock.provider.libsql.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)`);

	await using client = new Client({
		baseUrl: new URL("http://localhost"),
		fetch: async (input, init): Promise<globalThis.Response> => {
			const [response, promises] = await mock.server.handleRequest(new globalThis.Request(input, init));
			await Promise.allSettled(promises);
			return response;
		},
	})
		.asTyped<typeof testApp>();

	const prefFoo = { foo: true };
	const postA = { postId: ksuid("p_", 1), title: "A" };
	const postB = { postId: ksuid("p_", 2), title: "B" };
	const identity = {
		id: id("id_"),
		data: {
			firstName: "Foo",
			lastName: "Bar",
		},
	};
	const identityComponentEmail = {
		identityId: identity.id,
		componentId: "email",
		identification: "foo@test.local",
		confirmed: true,
		data: {},
	};
	const identityComponentPassword = {
		identityId: identity.id,
		componentId: "password",
		confirmed: true,
		data: {
			hash: await password.hashPassword("lepassword"),
		},
	};

	mock.service.document.atomic()
		.set(`auth/identity/${identity.id}` as never, identity as never)
		.set(`auth/identity/${identity.id}/component/${identityComponentEmail.componentId}` as never, identityComponentEmail as never)
		.set(`auth/identity/${identity.id}/component/${identityComponentPassword.componentId}` as never, identityComponentPassword as never)
		.set("users/foo/preferences" as never, prefFoo as never)
		.set(`posts/${postA.postId}` as never, postA as never)
		.set(`posts/${postB.postId}` as never, postB as never)
		.commit();

	await ctx.step("auth", async () => {
		const changes: Array<AuthenticationTokensObject | null> = [];
		client.credentials.onChange((tokens) => {
			changes.push(tokens);
		});

		using auth = await client.auth.begin("authentication");

		assert(auth.current?.step.kind === "component");
		assertEquals(auth.current.step.id, "email");

		await auth.submitPrompt("foo@test.local");

		assert(auth.current?.step.kind === "component");
		assertEquals(auth.current.step.id, "password");

		await auth.submitPrompt("lepassword");

		assert(auth.current === null);

		assert(client.credentials.tokens?.identity.id === identity.id);
		assertEquals(changes.length, 1);
		assertEquals(changes[0]?.identity.id, identity.id);

		await client.auth.signOut();

		assertEquals(changes.length, 2);
		assertEquals(changes[1], null);
	});

	await ctx.step("fetch", async () => {
		const result1 = await client.fetch(ref("hello"));
		assertEquals(result1.body, "Hello World");
		const result2 = await client.fetch(ref("hello-world"), {
			method: "POST",
			headers: { "content-type": "text/plain" },
			body: "Bar",
		});
		assertEquals(result2.body, "Hello Bar");
	});

	await ctx.step("document", async () => {
		const result1 = await client.document.get(ref("users/:userid/preferences", { userid: "foo" }));
		assertEquals(result1.data, { foo: true });
		const result2 = await client.document.getMany([
			ref("users/:userid/preferences", { userid: "foo" }),
			ref("users/:userid/preferences", { userid: "bar" }),
		]);
		assertEquals(result2.length, 1);
		assertObjectMatch(result2[0], { data: { foo: true } });
		const result3 = await Array.fromAsync(client.document.list({ prefix: ref("posts") }));
		assertObjectMatch(result3[0].document.data, postA);
		assertObjectMatch(result3[1].document.data, postB);
		await client.document.atomic()
			.check(ref("users/:userid/preferences", { userid: "baz" }), null)
			.set(ref("users/:userid/preferences", { userid: "baz" }), { foo: false, bar: "baz" })
			.delete(ref("users/:userid/preferences", { userid: "foo" }))
			.commit();
	});

	await ctx.step("table", async () => {
		// Authenticate so row security resolves to our identity
		{
			using auth = await client.auth.begin("authentication");
			await auth.submitPrompt("foo@test.local");
			await auth.submitPrompt("lepassword");
		}

		// Insert a row matching our identity (allowed by row security)
		await client.table.execute(
			(q) => q.insert("users").values((q) => ({ id: q.literal(identity.id) })),
			{},
		);

		// Insert another row (should be blocked by row security)
		await assertRejects(() =>
			client.table.execute(
				(q) => q.insert("users").values((q) => ({ id: q.literal("someone_else") })),
				{},
			)
		);

		// SELECT – row security injects WHERE users.id = identity.id
		const rows = await client.table.execute(
			(q) => q.select("users").map((q) => ({ id: q.ref("users", "id") })),
			{},
		);
		assertEquals(rows.length, 1);
		assertEquals(rows[0].id, identity.id);

		// Clean up
		await client.auth.signOut();
	});

	await ctx.step("storage", async () => {
		// Seed some files via the provider
		await mock.provider.storage.put("avatar", new TextEncoder().encode("avatar-data").buffer, {
			contentType: "image/png",
			metadata: { userId: "u1" },
		});
		await mock.provider.storage.put("uploads/photo1.jpg", new TextEncoder().encode("photo1").buffer, {
			contentType: "image/jpeg",
		});
		await mock.provider.storage.put("uploads/photo2.jpg", new TextEncoder().encode("photo2").buffer, {
			contentType: "image/jpeg",
		});

		// getMetadata
		const meta = await client.storage.getMetadata(ref("avatar"));
		assertEquals(meta.key, "avatar");
		assertEquals(meta.contentType, "image/png");
		assertExists(meta.etag);

		// getSignedUploadUrl
		const uploadUrl = await client.storage.getSignedUploadUrl(ref("avatar"), {
			contentType: "image/png",
		});
		assert(typeof uploadUrl.url === "string" && uploadUrl.url.length > 0);
		assertExists(uploadUrl.expiresAt);

		// getSignedDownloadUrl
		const downloadUrl = await client.storage.getSignedDownloadUrl(ref("avatar"));
		assert(typeof downloadUrl.url === "string" && downloadUrl.url.length > 0);
		assertExists(downloadUrl.expiresAt);

		// list folder
		const entries = await Array.fromAsync(client.storage.list({ prefix: ref("uploads") }));
		assertEquals(entries.length, 2);
		assert(entries[0].object.key.startsWith("uploads/"));
		assert(entries[1].object.key.startsWith("uploads/"));

		// delete
		await client.storage.delete(ref("avatar"));
		await assertRejects(
			() => client.storage.getMetadata(ref("avatar")),
			StorageObjectNotFoundError,
		);
	});

	await ctx.step("pubsub", async () => {
		using server = await serve(mock.server);
		await using stream = pubsub(mock);
		stream.drain();
		await client.connect(new URL(server.url));
		const presence = client.pubsub.subscribe(ref("presence")).values();
		await sleep(10);
		const userId = id("u_");
		await client.pubsub.publish(ref("presence"), { userId });
		await sleep(10);
		const msg = await presence.next();
		assertEquals(msg.value, { userId });
	});
});
