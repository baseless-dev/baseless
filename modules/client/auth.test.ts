import { assertEquals, assertExists } from "https://deno.land/std@0.118.0/testing/asserts.ts";
import { Server } from "https://baseless.dev/x/server/server.ts";
import { initializeAppWithTransport } from "./app.ts";
import { LocalTransport } from "./transports/mod.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.3.7/key/generate_key_pair.ts";
import { exportSPKI } from "https://deno.land/x/jose@v4.3.7/key/export.ts";
import type { KeyLike } from "https://deno.land/x/jose@v4.3.7/types.d.ts";
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
import {
	createUserWithEmailAndPassword,
	getAuth,
	signInAnonymously,
	signInWithEmailAndPassword,
	validateEmail,
} from "./auth.ts";

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

	return { server, dispose, publicKey };
}

async function setupApp(server: Server, publicKey: KeyLike) {
	const clientPublicKey = await exportSPKI(publicKey);
	const app = await initializeAppWithTransport({
		transport: new LocalTransport(server),
		clientPublicKey,
		clientPublicKeyAlg: "RS256",
		clientId: "foo",
	});
	const auth = await getAuth(app);
	const dispose = () => {
		clearInterval((auth as any)._timerTokenExpired);
	};
	return { app, auth, dispose };
}

Deno.test("sign-in anonymously", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer({
		allowAnonymousUser: true,
		allowSignMethodPassword: false,
	});
	const { auth, dispose: disposeApp } = await setupApp(server, publicKey);

	const user = await signInAnonymously(auth);
	assertExists(user.id);
	assertEquals(user.email, null);

	await disposeApp();
	await disposeServer();
});

Deno.test("create user with email", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer({
		allowAnonymousUser: false,
		allowSignMethodPassword: true,
	});
	const { auth, dispose: disposeApp } = await setupApp(server, publicKey);
	await createUserWithEmailAndPassword(auth, "test@example.org", "foobar");

	await disposeApp();
	await disposeServer();
});

Deno.test("validate email", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer({
		allowAnonymousUser: false,
		allowSignMethodPassword: true,
	});
	const { auth, dispose: disposeApp } = await setupApp(server, publicKey);

	let validationCode = "";
	createLogger((_ns, _lvl, msg) => {
		const matches = msg.match(/Validation code is "([^"]+)"/);
		if (matches) {
			validationCode = matches[1];
		}
	});
	await createUserWithEmailAndPassword(auth, "test@example.org", "foobar");
	await validateEmail(auth, validationCode, "test@example.org");

	await disposeApp();
	await disposeServer();
});

Deno.test("sign-in with email and password", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer({
		allowAnonymousUser: false,
		allowSignMethodPassword: true,
	});
	const { auth, dispose: disposeApp } = await setupApp(server, publicKey);

	let validationCode = "";
	createLogger((_ns, _lvl, msg) => {
		const matches = msg.match(/Validation code is "([^"]+)"/);
		if (matches) {
			validationCode = matches[1];
		}
	});
	await createUserWithEmailAndPassword(auth, "test@example.org", "foobar");
	await validateEmail(auth, validationCode, "test@example.org");
	const user = await signInWithEmailAndPassword(auth, "test@example.org", "foobar");
	assertExists(user.id);
	assertEquals(user.email, "test@example.org");
	assertEquals(user.emailConfirmed, true);

	await disposeApp();
	await disposeServer();
});
