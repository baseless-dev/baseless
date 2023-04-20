import { IdentityProvider } from "./identity.ts";
import {
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { autoid } from "../../shared/autoid.ts";
import { IdentityChallenge, IdentityIdentification } from "./identity.ts";

export default async function testIdentityProvider(
	ip: IdentityProvider,
	t: Deno.TestContext,
) {
	let identityId = "";
	await t.step("create", async () => {
		const id1 = await ip.create({ foo: "bar" });
		assertEquals(id1.meta, { foo: "bar" });
		identityId = id1.id;
	});

	await t.step("get", async () => {
		const id1 = await ip.get(identityId);
		assertEquals(id1.meta, { foo: "bar" });
	});

	await t.step("update", async () => {
		await ip.update({ id: identityId, meta: { foo: "foo" } });
		const ident1 = await ip.get(identityId);
		assertEquals(ident1.meta, { foo: "foo" });
		await assertRejects(() => ip.update({ id: autoid(), meta: {} }));
	});

	await t.step("delete", async () => {
		const id2 = await ip.create({ bar: "foo" });
		await ip.delete(id2.id);
		await assertRejects(() => ip.delete(id2.id));
		await assertRejects(() => ip.get(id2.id));
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
		await assertRejects(() => ip.createIdentification(ident1));
	});

	await t.step("getIdentification", async () => {
		const ident2 = await ip.getIdentification("username", "test");
		assertEquals(ident2, ident1);
	});

	await t.step("listIdentification", async () => {
		const idents = await ip.listIdentification(identityId);
		assertEquals(idents, [ident1]);
	});

	await t.step("updateIdentification", async () => {
		const ident2: IdentityIdentification = {
			...ident1,
			verified: true,
		};
		await ip.updateIdentification(ident2);
		const ident3 = await ip.getIdentification("username", "test");
		assertEquals(ident2, ident3);
		const ident4: IdentityIdentification = {
			...ident1,
			type: "foo",
		};
		await assertRejects(() => ip.updateIdentification(ident4));
	});

	await t.step("deleteIdentification", async () => {
		const ident2: IdentityIdentification = {
			...ident1,
			identification: "test2",
		};
		await ip.createIdentification(ident2);
		await ip.deleteIdentification(
			identityId,
			ident2.type,
			ident2.identification,
		);
		await assertRejects(() =>
			ip.deleteIdentification(identityId, ident2.type, ident2.identification)
		);
	});

	const challeng1: IdentityChallenge = {
		type: "password",
		identityId,
		meta: { hash: "foo" },
	};
	await t.step("createChallenge", async () => {
		await ip.createChallenge(challeng1);
		await assertRejects(() => ip.createChallenge(challeng1));
	});

	await t.step("getChallenge", async () => {
		const challeng2 = await ip.getChallenge(identityId, "password");
		assertEquals(challeng2, challeng1);
	});

	await t.step("listChallenge", async () => {
		const challengs = await ip.listChallenge(identityId);
		assertEquals(challengs, [challeng1]);
	});

	await t.step("updateIdentification", async () => {
		const challeng2: IdentityChallenge = {
			...challeng1,
			meta: { foo: "bar" },
		};
		await ip.updateChallenge(challeng2);
		const challeng3 = await ip.getChallenge(identityId, "password");
		assertEquals(challeng2, challeng3);
		const challeng4: IdentityChallenge = {
			...challeng1,
			type: "foo",
		};
		await assertRejects(() => ip.updateChallenge(challeng4));
	});

	await t.step("deleteIdentification", async () => {
		const challeng2: IdentityChallenge = {
			...challeng1,
			type: "password2"
		};
		await ip.createChallenge(challeng2);
		await ip.deleteChallenge(identityId, challeng2.type);
		await assertRejects(() => ip.deleteChallenge(identityId, challeng2.type));
	});
}
