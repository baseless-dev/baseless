import {
	assertEquals,
	assertExists,
	assertNotEquals,
	assertRejects,
} from "https://deno.land/std@0.118.0/testing/asserts.ts";
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
	AuthBuilder,
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
	resetPassword,
	sendEmailValidation,
	sendPasswordResetEmail,
	signInAnonymously,
	signInWithEmailAndPassword,
	updatePassword,
	validateEmail,
} from "./auth.ts";

async function setupServer(
	authDescriptor: AuthDescriptor = auth.build(),
) {
	const authStorage = new SqliteKVProvider(":memory:");
	const authProvider = new AuthOnKvProvider(authStorage);

	const { privateKey, publicKey } = await generateKeyPair("RS256");
	const clientProvider = new MemoryClientProvider([
		new Client("foo", "Foobar", ["http://example.org"], "RS256", publicKey, privateKey),
	]);

	await authStorage.open();
	const dispose = async () => {
		await authStorage.close();
	};

	const server = new Server(
		authDescriptor,
		database.build(),
		functions.build(),
		mail.build(),
		clientProvider,
		authProvider,
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
	const { server, dispose: disposeServer, publicKey } = await setupServer(
		new AuthBuilder().allowAnonymousUser(true).allowSignMethodPassword(false).build(),
	);
	const { auth, dispose: disposeApp } = await setupApp(server, publicKey);

	const user = await signInAnonymously(auth);
	assertExists(user.id);
	assertEquals(user.email, null);

	await disposeApp();
	await disposeServer();
});

Deno.test("create user with email", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer(
		new AuthBuilder().allowAnonymousUser(false).allowSignMethodPassword(true).build(),
	);
	const { auth, dispose: disposeApp } = await setupApp(server, publicKey);
	await createUserWithEmailAndPassword(auth, "test@example.org", "foobar");

	await disposeApp();
	await disposeServer();
});

Deno.test("validate email", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer(
		new AuthBuilder().allowAnonymousUser(false).allowSignMethodPassword(true).build(),
	);
	const { auth, dispose: disposeApp } = await setupApp(server, publicKey);

	let validationCode = "";
	createLogger((_ns, _lvl, msg) => {
		const matches = msg.match(/Validation code is "([^"]+)"/);
		if (matches) {
			validationCode = matches[1];
		}
	});
	await createUserWithEmailAndPassword(auth, "test@example.org", "foobar");
	assertNotEquals(validationCode, "");
	await assertRejects(() => validateEmail(auth, "wrong code", "test@example.org"));
	await assertRejects(() => validateEmail(auth, validationCode, "unknown@example.org"));
	await validateEmail(auth, validationCode, "test@example.org");

	await disposeApp();
	await disposeServer();
});

Deno.test("send email validation", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer(
		new AuthBuilder().allowAnonymousUser(false).allowSignMethodPassword(true).build(),
	);
	const { auth, dispose: disposeApp } = await setupApp(server, publicKey);

	await createUserWithEmailAndPassword(auth, "test@example.org", "foobar");
	let validationCode = "";
	createLogger((_ns, _lvl, msg) => {
		const matches = msg.match(/Validation code is "([^"]+)"/);
		if (matches) {
			validationCode = matches[1];
		}
	});
	await assertRejects(() => sendEmailValidation(auth, "unknown@example.org"));
	await sendEmailValidation(auth, "test@example.org");
	assertNotEquals(validationCode, "");

	await disposeApp();
	await disposeServer();
});

Deno.test("sign-in with email and password", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer(
		new AuthBuilder().allowAnonymousUser(false).allowSignMethodPassword(true).build(),
	);
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

Deno.test("send password reset email", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer(
		new AuthBuilder().allowAnonymousUser(false).allowSignMethodPassword(true).build(),
	);
	const { auth, dispose: disposeApp } = await setupApp(server, publicKey);

	await createUserWithEmailAndPassword(auth, "test@example.org", "foobar");

	let resetPasswordCode = "";
	createLogger((_ns, _lvl, msg) => {
		const matches = msg.match(/Reset password code is "([^"]+)"/);
		if (matches) {
			resetPasswordCode = matches[1];
		}
	});
	await assertRejects(() => sendPasswordResetEmail(auth, "unknown@example.org"));
	await sendPasswordResetEmail(auth, "test@example.org");
	assertNotEquals(resetPasswordCode, "");

	await disposeApp();
	await disposeServer();
});

Deno.test("reset password", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer(
		new AuthBuilder().allowAnonymousUser(false).allowSignMethodPassword(true).build(),
	);
	const { auth, dispose: disposeApp } = await setupApp(server, publicKey);

	let validationCode = "";
	createLogger((_ns, _lvl, msg) => {
		const matches = msg.match(/Validation code is "([^"]+)"/);
		if (matches) {
			validationCode = matches[1];
		}
	});
	await createUserWithEmailAndPassword(auth, "test@example.org", "foobar");
	assertNotEquals(validationCode, "");
	await validateEmail(auth, validationCode, "test@example.org");

	let resetPasswordCode = "";
	createLogger((_ns, _lvl, msg) => {
		const matches = msg.match(/Reset password code is "([^"]+)"/);
		if (matches) {
			resetPasswordCode = matches[1];
		}
	});
	await sendPasswordResetEmail(auth, "test@example.org");
	assertNotEquals(resetPasswordCode, "");
	await assertRejects(() => resetPassword(auth, "wrong code", "test@example.org", "moojoo"));
	await assertRejects(() => resetPassword(auth, resetPasswordCode, "unknown@example.org", "moojoo"));
	await resetPassword(auth, resetPasswordCode, "test@example.org", "moojoo");
	const user = await signInWithEmailAndPassword(auth, "test@example.org", "moojoo");
	assertExists(user.id);
	assertEquals(user.email, "test@example.org");
	assertEquals(user.emailConfirmed, true);

	await disposeApp();
	await disposeServer();
});

Deno.test("upgrade anonymous user", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer(
		new AuthBuilder().allowAnonymousUser(true).allowSignMethodPassword(true).build(),
	);
	const { auth, dispose: disposeApp } = await setupApp(server, publicKey);

	const anonymousUser = await signInAnonymously(auth);
	assertExists(anonymousUser.id);
	assertEquals(anonymousUser.email, null);
	let validationCode = "";
	createLogger((_ns, _lvl, msg) => {
		const matches = msg.match(/Validation code is "([^"]+)"/);
		if (matches) {
			validationCode = matches[1];
		}
	});
	await createUserWithEmailAndPassword(auth, "test@example.org", "foobar");
	assertNotEquals(validationCode, "");
	await validateEmail(auth, validationCode, "test@example.org");
	const user = await signInWithEmailAndPassword(auth, "test@example.org", "foobar");
	assertEquals(user.id, anonymousUser.id);
	assertEquals(user.email, "test@example.org");
	assertEquals(user.emailConfirmed, true);

	await disposeApp();
	await disposeServer();
});

Deno.test("update password", async () => {
	const { server, dispose: disposeServer, publicKey } = await setupServer(
		new AuthBuilder().allowAnonymousUser(false).allowSignMethodPassword(true).build(),
	);
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
	await signInWithEmailAndPassword(auth, "test@example.org", "foobar");
	await updatePassword(auth, "moojoo");
	const user = await signInWithEmailAndPassword(auth, "test@example.org", "moojoo");
	assertExists(user.id);
	assertEquals(user.email, "test@example.org");
	assertEquals(user.emailConfirmed, true);

	await disposeApp();
	await disposeServer();
});
