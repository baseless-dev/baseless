import {
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import type { IdentityProvider } from "./identity.ts";
import {
	assertID,
	assertIdentity,
	type Identity,
	IDENTITY_AUTOID_PREFIX,
} from "../common/identity/identity.ts";
import { autoid } from "../common/system/autoid.ts";

export default async function testIdentityProvider(
	ip: IdentityProvider,
	t: Deno.TestContext,
): Promise<void> {
	let identity: Identity;
	await t.step("create", async () => {
		identity = await ip.create({ foo: "bar" }, {});
		assertID(identity);
		assertEquals(identity.meta, { foo: "bar" });
	});

	await t.step("get", async () => {
		const id1 = await ip.get(identity.id);
		assertIdentity(id1);
		assertEquals(id1.meta, { foo: "bar" });
	});

	await t.step("update", async () => {
		await ip.update({ ...identity, meta: { foo: "foo" } });
		const id1 = await ip.get(identity.id);
		assertIdentity(id1);
		assertEquals(id1.meta, { foo: "foo" });
		await assertRejects(() =>
			ip.update({
				id: autoid(IDENTITY_AUTOID_PREFIX),
				meta: {},
				components: {},
			})
		);
	});

	await t.step("delete", async () => {
		const id2 = await ip.create({ bar: "foo" }, {});
		await ip.delete(id2.id);
		// await assertRejects(() => ip.delete(id2.id));
		// await assertRejects(() => ip.get(id2.id));
		// await ip.get(identityId);
	});
}
