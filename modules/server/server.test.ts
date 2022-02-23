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
	database,
	DatabaseDescriptor,
	functions,
	FunctionsDescriptor,
	mail,
	MailDescriptor,
} from "https://baseless.dev/x/worker/mod.ts";
import { createLogger } from "https://baseless.dev/x/logger/mod.ts";
import { Server } from "./server.ts";

async function setupServer(
	authDescriptor: AuthDescriptor = auth.build(),
	dbDescriptor: DatabaseDescriptor = database.build(),
	functionsDescriptor: FunctionsDescriptor = functions.build(),
	mailDescriptor: MailDescriptor = mail.build(),
) {
	const authStorage = new SqliteKVProvider(":memory:");
	const dbStorage = new SqliteKVProvider(":memory:");

	const authProvider = new AuthOnKvProvider(authStorage);
	const kvProvider = new SqliteKVProvider(":memory:");
	const dbProvider = new DatabaseOnKvProvider(dbStorage);

	const { privateKey, publicKey } = await generateKeyPair("RS256");
	const clientProvider = new MemoryClientProvider([
		new Client("foo", "Foobar", ["http://example.org"], "RS256", publicKey, privateKey),
	]);

	await authStorage.open();
	const dispose = async () => {
		await authStorage.close();
		await dbStorage.close();
		await kvProvider.close();
	};

	const server = new Server(
		authDescriptor,
		dbDescriptor,
		functionsDescriptor,
		mailDescriptor,
		clientProvider,
		authProvider,
		kvProvider,
		dbProvider,
		undefined,
	);

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
	const request = new Request("http://test.local/test", {
		method: "GET",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 405);

	await dispose();
});

Deno.test("request with pathname trigger function", async () => {
	const { server, dispose } = await setupServer(undefined, undefined, {
		https: [{
			path: "test",
			onCall(_req, _ctx) {
				return Promise.resolve(new Response(null, { status: 418 }));
			},
		}],
	});
	const request = new Request("http://test.local/test", {
		method: "GET",
		headers: { "X-BASELESS-CLIENT-ID": "foo", "Origin": "http://example.org" },
	});
	const [response] = await server.handleRequest(request);
	assertEquals(response.status, 418);

	await dispose();
});

Deno.test("request with pathname trigger function that throws returns 500", async () => {
	const { server, dispose } = await setupServer(undefined, undefined, {
		https: [{
			path: "test",
			onCall(_req, _ctx) {
				throw new Error("Log me!");
			},
		}],
	});
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
