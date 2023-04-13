import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { WebStorageKVProvider } from "../providers/kv-webstorage/mod.ts";
import { KVIdentityProvider } from "../providers/identity-kv/mod.ts";
import { MemoryCounterProvider } from "../providers/counter-memory/mod.ts";
import { LoggerEmailProvider } from "../providers/email-logger/mod.ts";
import { AuthenticationService } from "./auth.ts";
import { assertAutoId } from "../../shared/autoid.ts";

Deno.test("AuthenticationService", async (t) => {
	const authService = new AuthenticationService(
		new KVIdentityProvider(new WebStorageKVProvider(sessionStorage, import.meta.url + "createIdentity")),
		new MemoryCounterProvider(),
		new LoggerEmailProvider()
	);

	let identityId: string;
	await t.step("createIdentity", async () => {
		identityId = await authService.createIdentity({ foo: "bar" });
		assertAutoId(identityId);
	});

	await t.step("getIdentityById", async () => {
		const identity = await authService.getIdentityById(identityId);
		assertEquals(identity.id, identityId);
		assertEquals(identity.meta, { foo: "bar" });
	});

	await t.step("updateIdentity", async () => {
		await authService.updateIdentity(identityId, { foo: "foo" });
		const identity = await authService.getIdentityById(identityId);
		assertEquals(identity.meta, { foo: "foo" });
	});

	await t.step("deleteIdentity", async () => {
		const identityId = await authService.createIdentity({});
		await authService.deleteIdentity(identityId);
		await assertRejects(() => authService.getIdentityById(identityId));
	});

	let identificationId: string;
	await t.step("assignIdentification", async () => {
		const identification = await authService.assignIdentification(identityId, "email", "john@doe.local");
		assertAutoId(identification.id);
		identificationId = identification.id;
	});

	await t.step("listIdentification", async () => {
		const identifications = await authService.listIdentification(identityId);
		assertEquals(identifications, [{ identityId, id: identificationId, type: "email", identification: "john@doe.local" }]);
	});

	await t.step("unassignIdentification", async () => {
		const identification = await authService.assignIdentification(identityId, "email", "jannet@doe.local");
		assertAutoId(identification.id);
		await authService.unassignIdentification(identityId, identification.id);
		const identifications = await authService.listIdentification(identityId);
		assertEquals(identifications, [{ identityId, id: identificationId, type: "email", identification: "john@doe.local" }]);
	});

	await t.step("getIdentityIdentificationById", async () => {
		const identification = await authService.getIdentityIdentificationById(identityId, identificationId);
		assertEquals(identification.identityId, identityId);
		assertEquals(identification.id, identificationId);
	});

	await t.step("getIdentityIdentificationByType", async () => {
		const identification = await authService.getIdentityIdentificationByType("email", "john@doe.local");
		assertEquals(identification.identityId, identityId);
	});

	let challengeId: string;
	await t.step("assignChallenge", async () => {
		const challenge = await authService.assignChallenge(identityId, "password", "123");
		assertAutoId(challenge.id);
		challengeId = challenge.id;
	});

	await t.step("listChallenge", async () => {
		const challenges = await authService.listChallenge(identityId);
		assertEquals(challenges, [{ identityId, id: challengeId, type: "password", challenge: "123" }]);
	});

	await t.step("unassignChallenge", async () => {
		const challenge = await authService.assignChallenge(identityId, "password", "456");
		assertAutoId(challenge.id);
		await authService.unassignChallenge(identityId, challenge.id);
		const challenges = await authService.listChallenge(identityId);
		assertEquals(challenges, [{ identityId, id: challengeId, type: "password", challenge: "123" }]);
	});

	await t.step("forgotChallenge", async () => {
		// TODO
	});

	await t.step("resetChallenge", async () => {
		// TODO
	});
});