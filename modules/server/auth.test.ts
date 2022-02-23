import {
	assertEquals,
	assertExists,
	assertNotEquals,
	assertRejects,
} from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { generateKeyPair } from "https://deno.land/x/jose@v4.3.7/key/generate_key_pair.ts";
import { AuthController } from "./auth.ts";
import {
	Client,
	Context,
	NoopDatabaseProvider,
	NoopKVProvider,
	NoopMailProvider,
} from "https://baseless.dev/x/provider/mod.ts";
import { SqliteKVProvider } from "https://baseless.dev/x/provider-kv-sqlite/mod.ts";
import { AuthOnKvProvider } from "https://baseless.dev/x/provider-auth-on-kv/mod.ts";
import { AuthBuilder } from "https://baseless.dev/x/worker/mod.ts";
import { createLogger } from "https://baseless.dev/x/logger/mod.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.3.7/jwt/verify.ts";

async function setupContext() {
	const { privateKey, publicKey } = await generateKeyPair("RS256");

	const client = new Client("foo", "Foobar", ["http://example.org"], "RS256", publicKey, privateKey);

	const waitUntilCollection: PromiseLike<unknown>[] = [];

	const auth = new SqliteKVProvider(":memory:");
	await auth.open();

	const context: Context = {
		auth: new AuthOnKvProvider(auth),
		client: client,
		kv: new NoopKVProvider(),
		database: new NoopDatabaseProvider(),
		mail: new NoopMailProvider(),
		waitUntil(promise) {
			waitUntilCollection.push(promise);
		},
	};

	const dispose = async () => {
		await auth.close();
	};

	return { context, dispose, waitUntilCollection, client };
}

async function getTokenSub(client: Client, token: string) {
	const { payload } = await jwtVerify(token, client.publicKey, {
		issuer: client.principal,
		audience: client.principal,
	});
	return payload.sub ?? "";
}

Deno.test("send validation email", async () => {
	const { context, dispose } = await setupContext();

	{ // Create user with email sends a validation code
		const authDescriptor = new AuthBuilder().allowSignMethodPassword(true).build();
		const authController = new AuthController(authDescriptor);

		let validationCode = "";
		createLogger((_ns, _lvl, msg) => {
			const matches = msg.match(/Validation code is "([^"]+)"/);
			if (matches) {
				validationCode = matches[1];
			}
		});
		assertEquals({}, await authController.createUserWithEmail(context, "en", "test@example.org", "foobar"));
		assertNotEquals(validationCode, "");
		createLogger(undefined);
	}
	{ // Resend validation email
		const authDescriptor = new AuthBuilder().allowSignMethodPassword(true).build();
		const authController = new AuthController(authDescriptor);

		assertEquals({}, await authController.createUserWithEmail(context, "en", "test@example.org", "foobar"));

		let validationCode = "";
		createLogger((_ns, _lvl, msg) => {
			const matches = msg.match(/Validation code is "([^"]+)"/);
			if (matches) {
				validationCode = matches[1];
			}
		});
		assertEquals({}, await authController.sendValidationEmail(context, "en", "test@example.org"));
		assertNotEquals(validationCode, "");
		createLogger(undefined);
	}

	await dispose();
});

Deno.test("validate email with code", async () => {
	const { context, dispose } = await setupContext();
	const authDescriptor = new AuthBuilder().allowSignMethodPassword(true).build();
	const authController = new AuthController(authDescriptor);

	{ // Validate email with code
		let validationCode = "";
		createLogger((_ns, _lvl, msg) => {
			const matches = msg.match(/Validation code is "([^"]+)"/);
			if (matches) {
				validationCode = matches[1];
			}
		});
		assertEquals({}, await authController.createUserWithEmail(context, "en", "test@example.org", "foobar"));
		assertNotEquals(validationCode, "");
		createLogger(undefined);
		await assertRejects(() => authController.validateEmailWithCode(context, "test@example.org", "blep"));
		assertEquals({}, await authController.validateEmailWithCode(context, "test@example.org", validationCode));
	}

	await dispose();
});

Deno.test("send password reset email", async () => {
	const { context, dispose } = await setupContext();

	{ // Resend validation email
		const authDescriptor = new AuthBuilder().allowSignMethodPassword(true).build();
		const authController = new AuthController(authDescriptor);

		assertEquals({}, await authController.createUserWithEmail(context, "en", "test@example.org", "foobar"));

		let resetPasswordCode = "";
		createLogger((_ns, _lvl, msg) => {
			const matches = msg.match(/Reset password code is "([^"]+)"/);
			if (matches) {
				resetPasswordCode = matches[1];
			}
		});
		assertEquals({}, await authController.sendPasswordResetEmail(context, "en", "test@example.org"));
		assertNotEquals(resetPasswordCode, "");
		createLogger(undefined);
	}

	await dispose();
});

Deno.test("reset password with code", async () => {
	const { context, dispose } = await setupContext();
	const authDescriptor = new AuthBuilder().allowSignMethodPassword(true).build();
	const authController = new AuthController(authDescriptor);

	{ // Validate email with code
		assertEquals({}, await authController.createUserWithEmail(context, "en", "test@example.org", "foobar"));

		let resetPasswordCode = "";
		createLogger((_ns, _lvl, msg) => {
			const matches = msg.match(/Reset password code is "([^"]+)"/);
			if (matches) {
				resetPasswordCode = matches[1];
			}
		});
		assertEquals({}, await authController.sendPasswordResetEmail(context, "en", "test@example.org"));
		assertNotEquals(resetPasswordCode, "");
		createLogger(undefined);
		await assertRejects(() => authController.resetPasswordWithCode(context, "test@example.org", "blep", "moojoo"));
		assertEquals(
			{},
			await authController.resetPasswordWithCode(context, "test@example.org", resetPasswordCode, "mahoo"),
		);
	}

	await dispose();
});

Deno.test("create anonymous user", async () => {
	const { context, dispose } = await setupContext();

	{ // Sign-in anonymously is not allowed
		const authDescriptor = new AuthBuilder().allowAnonymousUser(false).build();
		const authController = new AuthController(authDescriptor);
		await assertRejects(() => authController.createAnonymousUser(context));
	}
	{ // Sign-in anonymously
		const authDescriptor = new AuthBuilder().allowAnonymousUser(true).build();
		const authController = new AuthController(authDescriptor);
		assertExists(await authController.createAnonymousUser(context));
	}

	await dispose();
});

Deno.test("add sign with email password", async () => {
	const { context, dispose, client } = await setupContext();

	{ // Sign-in anonymously and add sign in with email password
		const authDescriptor = new AuthBuilder().allowAnonymousUser(true).allowSignMethodPassword(true).build();
		const authController = new AuthController(authDescriptor);
		const tokens = await authController.createAnonymousUser(context) as Record<string, string>;
		assertExists("access_token" in tokens);
		const currentUserId = await getTokenSub(client, tokens.access_token);
		assertEquals(
			{},
			await authController.addSignWithEmailPassword({ ...context, currentUserId }, "en", "test@example.org", "foobar"),
		);
	}

	await dispose();
});

Deno.test("create user with email", async () => {
	const { context, dispose } = await setupContext();

	{ // Sign-in with email and password is not allowed
		const authDescriptor = new AuthBuilder().allowSignMethodPassword(false).build();
		const authController = new AuthController(authDescriptor);
		await assertRejects(() => authController.createUserWithEmail(context, "en", "test@example.org", "foobar"));
	}
	{ // Sign-in with email and password more than once does not leak "user exists error"
		const authDescriptor = new AuthBuilder().allowSignMethodPassword(true).build();
		const authController = new AuthController(authDescriptor);
		assertEquals({}, await authController.createUserWithEmail(context, "en", "test@example.org", "foobar"));
		assertEquals({}, await authController.createUserWithEmail(context, "en", "test@example.org", "foobar"));
	}

	await dispose();
});

Deno.test("sign with email password", async () => {
	const { context, dispose } = await setupContext();
	const authDescriptor = new AuthBuilder().allowSignMethodPassword(true).build();
	const authController = new AuthController(authDescriptor);

	{ // Create and validate
		let validationCode = "";
		createLogger((_ns, _lvl, msg) => {
			const matches = msg.match(/Validation code is "([^"]+)"/);
			if (matches) {
				validationCode = matches[1];
			}
		});
		assertEquals({}, await authController.createUserWithEmail(context, "en", "test@example.org", "foobar"));
		assertNotEquals(validationCode, "");
		createLogger(undefined);
		await assertRejects(() => authController.validateEmailWithCode(context, "test@example.org", "blep"));
		assertEquals({}, await authController.validateEmailWithCode(context, "test@example.org", validationCode));
	}
	{ // Sign in with email and password
		await assertRejects(() => authController.signWithEmailPassword(context, "test@example.org", "wrongpassword"));
		assertExists(await authController.signWithEmailPassword(context, "test@example.org", "foobar"));
	}
	{ // Password reset
		let resetPasswordCode = "";
		createLogger((_ns, _lvl, msg) => {
			const matches = msg.match(/Reset password code is "([^"]+)"/);
			if (matches) {
				resetPasswordCode = matches[1];
			}
		});
		assertEquals({}, await authController.sendPasswordResetEmail(context, "en", "test@example.org"));
		assertNotEquals(resetPasswordCode, "");
		createLogger(undefined);
		assertEquals(
			{},
			await authController.resetPasswordWithCode(context, "test@example.org", resetPasswordCode, "moojoo"),
		);
		await assertRejects(() => authController.signWithEmailPassword(context, "test@example.org", "foobar"));
		assertExists(await authController.signWithEmailPassword(context, "test@example.org", "moojoo"));
	}

	await dispose();
});

Deno.test("refresh tokens", async () => {
	const { context, dispose, client } = await setupContext();
	const authDescriptor = new AuthBuilder().allowSignMethodPassword(true).build();
	const authController = new AuthController(authDescriptor);

	{ // Create and validate
		let validationCode = "";
		createLogger((_ns, _lvl, msg) => {
			const matches = msg.match(/Validation code is "([^"]+)"/);
			if (matches) {
				validationCode = matches[1];
			}
		});
		assertEquals({}, await authController.createUserWithEmail(context, "en", "test@example.org", "foobar"));
		assertNotEquals(validationCode, "");
		createLogger(undefined);
		await assertRejects(() => authController.validateEmailWithCode(context, "test@example.org", "blep"));
		assertEquals({}, await authController.validateEmailWithCode(context, "test@example.org", validationCode));
	}
	{ // Sign in and refresh tokens
		await assertRejects(() => authController.signWithEmailPassword(context, "test@example.org", "wrongpassword"));
		const tokens = await authController.signWithEmailPassword(context, "test@example.org", "foobar") as Record<
			string,
			string
		>;
		assertEquals("refresh_token" in tokens, true);
		const newTokens = await authController.refreshTokens(context, tokens.refresh_token);
		assertEquals("access_token" in newTokens, true);
	}

	await dispose();
});

Deno.test("update password", async () => {
	const { context, dispose, client } = await setupContext();
	const authDescriptor = new AuthBuilder().allowSignMethodPassword(true).build();
	const authController = new AuthController(authDescriptor);

	let validationCode = "";
	createLogger((_ns, _lvl, msg) => {
		const matches = msg.match(/Validation code is "([^"]+)"/);
		if (matches) {
			validationCode = matches[1];
		}
	});
	await authController.createUserWithEmail(context, "en", "test@example.org", "foobar");
	assertNotEquals(validationCode, "");
	await authController.validateEmailWithCode(context, "test@example.org", validationCode);

	const tokens = await authController.signWithEmailPassword(context, "test@example.org", "foobar") as Record<
		string,
		string
	>;
	assertExists("access_token" in tokens);
	const currentUserId = await getTokenSub(client, tokens.access_token);

	assertEquals({}, await authController.updatePassword({ ...context, currentUserId }, "moojoo"));
	assertExists(await authController.signWithEmailPassword(context, "test@example.org", "moojoo"));

	await dispose();
});
