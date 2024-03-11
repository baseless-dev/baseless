import {
	assert,
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.213.0/assert/mod.ts";
import type { IdentityProvider } from "./provider.ts";
import {
	type Identity,
	IDENTITY_AUTOID_PREFIX,
	IdentitySchema,
	IDSchema,
} from "../../lib/identity/types.ts";
import { ruid } from "../../lib/autoid.ts";
import { Value } from "../../lib/typebox.ts";

export default async function testIdentityProvider(
	ip: IdentityProvider,
	t: Deno.TestContext,
): Promise<void> {
	let identity: Identity;
	await t.step("create", async () => {
		identity = await ip.create({ foo: "bar" }, []);
		assert(Value.Check(IDSchema, identity));
		assertEquals(identity.meta, { foo: "bar" });
	});

	await t.step("get", async () => {
		const id1 = await ip.get(identity.id);
		assert(Value.Check(IdentitySchema, id1));
		assertEquals(id1.meta, { foo: "bar" });
	});

	await t.step("update", async () => {
		await ip.update({ ...identity, meta: { foo: "foo" } });
		const id1 = await ip.get(identity.id);
		assert(Value.Check(IdentitySchema, id1));
		assertEquals(id1.meta, { foo: "foo" });
		await assertRejects(() =>
			ip.update({
				id: ruid(IDENTITY_AUTOID_PREFIX),
				meta: {},
				components: [],
			})
		);
	});

	await t.step("delete", async () => {
		const id2 = await ip.create({ bar: "foo" }, []);
		await ip.delete(id2.id);
		// await assertRejects(() => ip.delete(id2.id));
		// await assertRejects(() => ip.get(id2.id));
		// await ip.get(identityId);
	});
}
