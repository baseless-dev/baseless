import {
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import type { IdentityProvider } from "./identity.ts";
import { assertIdentity } from "../common/identity/identity.ts";
import { autoid } from "../common/system/autoid.ts";
import type { IdentityIdentification } from "../common/identity/identification.ts";
import type { IdentityChallenge } from "../common/identity/challenge.ts";
import { assertResultError, assertResultOk, unwrap } from "../common/system/result.ts";

export default async function testIdentityProvider(
	ip: IdentityProvider,
	t: Deno.TestContext,
) {
	let identityId = "";
	await t.step("create", async () => {
		const id1 = unwrap(await ip.create({ foo: "bar" }));
		assertIdentity(id1);
		assertEquals(id1.meta, { foo: "bar" });
		identityId = id1.id;
	});

	await t.step("get", async () => {
		const id1 = unwrap(await ip.get(identityId));
		assertIdentity(id1);
		assertEquals(id1.meta, { foo: "bar" });
	});

	await t.step("update", async () => {
		await ip.update({ id: identityId, meta: { foo: "foo" } });
		const ident1 = unwrap(await ip.get(identityId));
		assertIdentity(ident1);
		assertEquals(ident1.meta, { foo: "foo" });
		assertResultError(await ip.update({ id: autoid(), meta: {} }));
	});

	await t.step("delete", async () => {
		const id2 = unwrap(await ip.create({ bar: "foo" }));
		await ip.delete(id2.id);
		assertResultError(await ip.delete(id2.id));
		assertResultError(await ip.get(id2.id));
		await ip.get(identityId);
	});

	const ident1: IdentityIdentification = {
		type: "username",
		identityId,
		identification: "test",
		meta: {},
		verified: false,
	};
	await t.step("createIdentification", async () => {
		await ip.createIdentification(ident1);
		assertResultError(await ip.createIdentification(ident1));
	});

	await t.step("matchIdentification", async () => {
		const ident2 = unwrap(await ip.matchIdentification("username", "test"));
		assertEquals(ident2, ident1);
	});

	await t.step("listIdentification", async () => {
		const idents = unwrap(await ip.listIdentification(identityId));
		assertEquals(idents, [ident1]);
	});

	await t.step("updateIdentification", async () => {
		const ident2: IdentityIdentification = {
			...ident1,
			verified: true,
		};
		await ip.updateIdentification(ident2);
		const ident3 = unwrap(await ip.matchIdentification("username", "test"));
		assertEquals(ident2, ident3);
		const ident4: IdentityIdentification = {
			...ident1,
			type: "foo",
		};
		assertResultError(await ip.updateIdentification(ident4));
	});

	await t.step("deleteIdentification", async () => {
		const ident2: IdentityIdentification = {
			...ident1,
			identification: "test2",
		};
		assertResultOk(await ip.createIdentification(ident2));
		assertResultOk(await ip.deleteIdentification(
			identityId,
			ident2.type,
			ident2.identification,
		));
		assertResultError(await
			ip.deleteIdentification(identityId, ident2.type, ident2.identification)
		);
	});

	const challeng1: IdentityChallenge = {
		type: "password",
		identityId,
		meta: { hash: "foo" },
	};
	await t.step("createChallenge", async () => {
		assertResultOk(await ip.createChallenge(challeng1));
		assertResultError(await ip.createChallenge(challeng1));
	});

	await t.step("getChallenge", async () => {
		const challeng2 = unwrap(await ip.getChallenge(identityId, "password"));
		assertEquals(challeng2, challeng1);
	});

	await t.step("listChallenge", async () => {
		const challengs = unwrap(await ip.listChallenge(identityId));
		assertEquals(challengs, [challeng1]);
	});

	await t.step("updateIdentification", async () => {
		const challeng2: IdentityChallenge = {
			...challeng1,
			meta: { foo: "bar" },
		};
		await ip.updateChallenge(challeng2);
		const challeng3 = unwrap(await ip.getChallenge(identityId, "password"));
		assertEquals(challeng2, challeng3);
		const challeng4: IdentityChallenge = {
			...challeng1,
			type: "foo",
		};
		assertResultError(await ip.updateChallenge(challeng4));
	});

	await t.step("deleteIdentification", async () => {
		const challeng2: IdentityChallenge = {
			...challeng1,
			type: "password2",
		};
		assertResultOk(await ip.createChallenge(challeng2));
		assertResultOk(await ip.deleteChallenge(identityId, challeng2.type));
		assertResultError(await ip.deleteChallenge(identityId, challeng2.type));
	});
}
