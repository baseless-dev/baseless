import { assertEquals, assertRejects } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { WebStorageKVProvider } from "../kv-webstorage/mod.ts";
import { KVIdentityProvider } from "./mod.ts";

Deno.test("createIdentity, getIdentityById", async () => {
	const kv = new WebStorageKVProvider(sessionStorage, "identity-kv-test-createIdentity/");
	const ip = new KVIdentityProvider(kv);
	const id1 = await ip.createIdentity({});
	const identity1 = await ip.getIdentityById(id1);
	const id2 = await ip.createIdentity({ foo: "bar" });
	const identity2 = await ip.getIdentityById(id2);
	assertEquals(identity1.id, id1);
	assertEquals(identity1.meta, {});
	assertEquals(identity2.id, id2);
	assertEquals(identity2.meta, { foo: "bar" });
});

Deno.test("updateIdentity", async () => {
	const kv = new WebStorageKVProvider(sessionStorage, "identity-kv-test-updateIdentity/");
	const ip = new KVIdentityProvider(kv);
	const id1 = await ip.createIdentity({});
	const identity1 = await ip.getIdentityById(id1);
	assertEquals(identity1.id, id1);
	assertEquals(identity1.meta, {});
	await ip.updateIdentity(id1, { foo: "bar" });
	const identity2 = await ip.getIdentityById(id1);
	assertEquals(identity2.id, id1);
	assertEquals(identity2.meta, { foo: "bar" });
});

Deno.test("deleteIdentityById", async () => {
	const kv = new WebStorageKVProvider(sessionStorage, "identity-kv-test-deleteIdentityById/");
	const ip = new KVIdentityProvider(kv);
	const id1 = await ip.createIdentity({});
	await ip.deleteIdentityById(id1);
	assertRejects(() => ip.getIdentityById(id1));
});

Deno.test("assignIdentityIdentification, getIdentityIdentificationByType, listIdentityIdentification", async () => {
	const kv = new WebStorageKVProvider(sessionStorage, "identity-kv-test-assignAuthenticationStep/");
	const ip = new KVIdentityProvider(kv);
	const id1 = await ip.createIdentity({});
	await ip.assignIdentityIdentification(id1, "email", "john@doe.local");
	assertEquals((await ip.getIdentityIdentificationByType("email", "john@doe.local")).identityId, id1);
	assertEquals((await ip.listIdentityIdentification(id1)).length, 1);
});

Deno.test("unassignStepIdentifier", async () => {
	const kv = new WebStorageKVProvider(sessionStorage, "identity-kv-test-unassignStepIdentifier/");
	const ip = new KVIdentityProvider(kv);
	const id1 = await ip.createIdentity({});
	const identification = await ip.assignIdentityIdentification(id1, "email", "john@doe.local");
	assertEquals((await ip.listIdentityIdentification(id1)).length, 1);
	await ip.unassignIdentityIdentification(id1, identification.id);
	assertEquals(await ip.listIdentityIdentification(id1), []);
});

Deno.test("assignStepChallenge, listStepChallenge, testStepChallenge", async () => {
	const kv = new WebStorageKVProvider(sessionStorage, "identity-kv-test-assignStepChallenge/");
	const ip = new KVIdentityProvider(kv);
	const id1 = await ip.createIdentity({});
	await ip.assignIdentityChallenge(id1, "password", "123");
	assertEquals((await ip.listIdentityChallenge(id1)).length, 1);
	assertEquals(await ip.testIdentityChallenge(id1, "password", "123"), true);
	assertEquals(await ip.testIdentityChallenge(id1, "password", "abc"), false);
});

Deno.test("unassignStepChallenge", async () => {
	const kv = new WebStorageKVProvider(sessionStorage, "identity-kv-test-assignStepChallenge/");
	const ip = new KVIdentityProvider(kv);
	const id1 = await ip.createIdentity({});
	const identification1 = await ip.assignIdentityChallenge(id1, "password", "123");
	const identification2 = await ip.assignIdentityChallenge(id1, "otp", "123456");
	assertEquals((await ip.listIdentityChallenge(id1)).length, 2);
	await ip.unassignIdentityChallenge(id1, identification1.id);
	assertEquals((await ip.listIdentityChallenge(id1)).length, 1);
	await ip.unassignIdentityChallenge(id1, identification2.id);
	assertEquals(await ip.listIdentityChallenge(id1), []);
});
