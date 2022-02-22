import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { SqliteKVProvider } from "https://baseless.dev/x/provider-kv-sqlite/mod.ts";
import { createLogger } from "https://baseless.dev/x/logger/mod.ts";
import { AuthOnKvProvider } from "./mod.ts";

Deno.test("creates anonymous user", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();

	const auth = new AuthOnKvProvider(kv);
	const user = await auth.createUser(null, {});
	assertExists(user);
	assertEquals(await auth.getSignInMethods(user.id), []);

	await kv.close();
});
Deno.test("creates user", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();

	const auth = new AuthOnKvProvider(kv);
	const user = await auth.createUser("test@example.org", {});

	assertEquals(await auth.getSignInMethods(user.id), []);

	// User already exist with that email
	await assertRejects(() => auth.createUser("test@example.org", {}));

	// User can register back
	await auth.deleteUser(user.id);
	assertExists(await auth.createUser("test@example.org", {}));

	await kv.close();
});

Deno.test("deletes user", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();

	const auth = new AuthOnKvProvider(kv);
	const user = await auth.createUser("test@example.org", {});

	// User can register back
	await auth.deleteUser(user.id);
	assertExists(await auth.createUser("test@example.org", {}));

	await kv.close();
});

Deno.test("retrieve user with id", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();

	const auth = new AuthOnKvProvider(kv);
	const user = await auth.createUser(null, {});
	assertExists(await auth.getUser(user.id));

	await kv.close();
});

Deno.test("retrieve user with email", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();

	const auth = new AuthOnKvProvider(kv);
	await auth.createUser("test@example.org", {});
	assertExists(await auth.getUserByEmail("test@example.org"));

	await kv.close();
});

Deno.test("update user", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();

	const auth = new AuthOnKvProvider(kv);
	const user = await auth.createUser("test@example.org", {});
	assertEquals(user.metadata, {});

	{ // Update metadata
		await auth.updateUser(user.id, { a: 1 });
		const updatedUser = await auth.getUser(user.id);
		assertEquals(updatedUser.metadata, { a: 1 });
	}

	{ // Update email
		await auth.updateUser(user.id, undefined, "foo@example.com");
		const updatedUser = await auth.getUser(user.id);
		assertEquals(updatedUser.email, "foo@example.com");
		assertEquals(updatedUser.emailConfirmed, false);

		await assertRejects(() => auth.createUser("foo@example.com", {}));
	}

	{ // Confirm email
		await auth.updateUser(user.id, undefined, undefined, true);
		const updatedUser = await auth.getUser(user.id);
		assertEquals(updatedUser.emailConfirmed, true);
	}

	{ // Update refreshToken
		await auth.updateUser(user.id, undefined, undefined, undefined, "foo");
		const updatedUser = await auth.getUser(user.id);
		assertEquals(updatedUser.refreshTokenId, "foo");
	}

	await kv.close();
});

Deno.test("add sign-in with password", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();

	const auth = new AuthOnKvProvider(kv);
	const user = await auth.createUser("test@example.org", {});
	await auth.addSignInMethodPassword(user.id, "foo");

	assertEquals(["password"], await auth.getSignInMethods(user.id));

	await kv.close();
});

Deno.test("sign-in with email and password", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();

	const auth = new AuthOnKvProvider(kv);
	const user = await auth.createUser("test@example.org", {});

	await assertRejects(() => auth.signInWithEmailPassword("test@example.org", "foo"));

	await auth.addSignInMethodPassword(user.id, "foo");

	const userSignedIn = await auth.signInWithEmailPassword("test@example.org", "foo");
	assertEquals(userSignedIn.id, user.id);

	await kv.close();
});

Deno.test("validate email with code", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();

	const auth = new AuthOnKvProvider(kv);
	const user = await auth.createUser("test@example.org", {});
	assertEquals(user.emailConfirmed, false);

	await assertRejects(() => auth.validateEmailWithCode(user.email!, "foo"));
	await auth.setEmailValidationCode(user.email!, "foo");
	await auth.validateEmailWithCode(user.email!, "foo");

	const userUpdated = await auth.getUser(user.id);
	assertEquals(userUpdated.emailConfirmed, true);

	await kv.close();
});

Deno.test("reset password with code", async () => {
	const kv = new SqliteKVProvider(":memory:");
	await kv.open();

	const auth = new AuthOnKvProvider(kv);
	const user = await auth.createUser("test@example.org", {});
	await auth.addSignInMethodPassword(user.id, "foo");

	await assertRejects(() => auth.resetPasswordWithCode(user.email!, "foo", "bar"));
	await auth.setPasswordResetCode(user.email!, "foo");
	await auth.resetPasswordWithCode(user.email!, "foo", "bar");

	await assertRejects(() => auth.signInWithEmailPassword("test@example.org", "foo"));
	const userSignedIn = await auth.signInWithEmailPassword("test@example.org", "bar");
	assertEquals(userSignedIn.id, user.id);

	await kv.close();
});
