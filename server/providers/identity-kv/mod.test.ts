import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { KVWebStorageProvider } from "../kv-webstorage/mod.ts";
import { IdentityKVProvider } from "./mod.ts";
import { autoid } from "../../../shared/autoid.ts";

Deno.test("createIdentity, getIdentityById", async () => {
	const kv = new KVWebStorageProvider(sessionStorage, "identity-kv-test-createIdentity/");
	const ip = new IdentityKVProvider(kv);
	const id1 = autoid();
	const id2 = autoid();
	await ip.createIdentity(id1, {});
	const identity1 = await ip.getIdentityById(id1);
	await ip.createIdentity(id2, { foo: "bar" });
	const identity2 = await ip.getIdentityById(id2);
	assertEquals(identity1.id, id1);
	assertEquals(identity1.meta, {});
	assertEquals(identity2.id, id2);
	assertEquals(identity2.meta, { foo: "bar" });
	assertRejects(() => ip.createIdentity(id1, {}));
});

Deno.test("updateIdentity", async () => {
	const kv = new KVWebStorageProvider(sessionStorage, "identity-kv-test-updateIdentity/");
	const ip = new IdentityKVProvider(kv);
	const id1 = autoid();
	await ip.createIdentity(id1, {});
	const identity1 = await ip.getIdentityById(id1);
	assertEquals(identity1.id, id1);
	assertEquals(identity1.meta, {});
	await ip.updateIdentity(id1, { foo: "bar" });
	const identity2 = await ip.getIdentityById(id1);
	assertEquals(identity2.id, id1);
	assertEquals(identity2.meta, { foo: "bar" });
});

Deno.test("deleteIdentityById", async () => {
	const kv = new KVWebStorageProvider(sessionStorage, "identity-kv-test-deleteIdentityById/");
	const ip = new IdentityKVProvider(kv);
	const id1 = autoid();
	await ip.createIdentity(id1, {});
	const step = { ident: "email", id: "john@doe.local", identity: id1, meta: {} };
	// await ip.assignAuthenticationStep(step);
	await ip.deleteIdentityById(id1);
	assertRejects(() => ip.getIdentityById(id1));
});

Deno.test("assignIdentityIdentification, getIdentityByIdentification, listIdentityIdentification", async () => {
	const kv = new KVWebStorageProvider(sessionStorage, "identity-kv-test-assignAuthenticationStep/");
	const ip = new IdentityKVProvider(kv);
	const id1 = autoid();
	const id2 = autoid();
	await ip.createIdentity(id1, {});
	await ip.assignIdentityIdentification(id1, "email", "john@doe.local");
	assertRejects(() => ip.assignIdentityIdentification(id2, "email", "john@doe.local"));
	assertEquals(await ip.getIdentityByIdentification("email", "john@doe.local"), id1);
	assertEquals(await ip.listIdentityIdentification(id1), [{ identifier: "email", uniqueId: "john@doe.local" }]);
});

Deno.test("unassignStepIdentifier", async () => {
	const kv = new KVWebStorageProvider(sessionStorage, "identity-kv-test-unassignStepIdentifier/");
	const ip = new IdentityKVProvider(kv);
	const id1 = autoid();
	const id2 = autoid();
	await ip.createIdentity(id1, {});
	await ip.assignIdentityIdentification(id1, "email", "john@doe.local");
	assertEquals(await ip.listIdentityIdentification(id1), [{ identifier: "email", uniqueId: "john@doe.local" }]);
	await ip.unassignIdentityIdentification(id1, "email", "john@doe.local");
	assertEquals(await ip.listIdentityIdentification(id1), []);

	await ip.assignIdentityIdentification(id2, "email", "john@doe.local");
});

Deno.test("assignStepChallenge, listStepChallenge, testStepChallenge", async () => {
	const kv = new KVWebStorageProvider(sessionStorage, "identity-kv-test-assignStepChallenge/");
	const ip = new IdentityKVProvider(kv);
	const id1 = autoid();
	const id2 = autoid();
	await ip.createIdentity(id1, {});
	await ip.assignIdentityChallenge(id1, "password", "123");
	assertEquals(await ip.listIdentityChallenge(id1), [{ identifier: "password", challenge: "123" }]);
	assertEquals(await ip.testIdentityChallenge(id1, "password", "123"), true);
	assertEquals(await ip.testIdentityChallenge(id1, "password", "abc"), false);
	assertEquals(await ip.testIdentityChallenge(id2, "password", "123"), false);
});

Deno.test("unassignStepChallenge", async () => {
	const kv = new KVWebStorageProvider(sessionStorage, "identity-kv-test-assignStepChallenge/");
	const ip = new IdentityKVProvider(kv);
	const id1 = autoid();
	await ip.createIdentity(id1, {});
	await ip.assignIdentityChallenge(id1, "password", "123");
	await ip.assignIdentityChallenge(id1, "otp", "123456");
	assertEquals(await ip.listIdentityChallenge(id1), [{ identifier: "otp", challenge: "123456" }, { identifier: "password", challenge: "123" }]);
	await ip.unassignIdentityChallenge(id1, "password", "123");
	assertEquals(await ip.listIdentityChallenge(id1), [{ identifier: "otp", challenge: "123456" }]);
	await ip.unassignIdentityChallenge(id1, "otp", "123456");
	assertEquals(await ip.listIdentityChallenge(id1), []);
});
