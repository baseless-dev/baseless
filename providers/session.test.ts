import { assert, assertEquals, assertRejects } from "../deps.test.ts";
import type { SessionProvider } from "./session.ts";
import { ruid } from "../lib/autoid.ts";
import { IDENTITY_AUTOID_PREFIX } from "../lib/identity/types.ts";
import { type SessionData, SessionDataSchema } from "../lib/session/types.ts";
import { Value } from "../deps.ts";

export default async function testSessionProvider(
	session: SessionProvider,
	t: Deno.TestContext,
): Promise<void> {
	const identityId1 = ruid(IDENTITY_AUTOID_PREFIX);
	const identityId2 = ruid(IDENTITY_AUTOID_PREFIX);
	let sessionData1: SessionData | undefined;
	let sessionData2: SessionData | undefined;

	await t.step("create", async () => {
		sessionData1 = await session.create(identityId1, {});
		assert(Value.Check(SessionDataSchema, sessionData1));
		assertEquals(sessionData1.identityId, identityId1);
	});

	await t.step("create with expiration", async () => {
		sessionData2 = await session.create(identityId2, {}, 100);
		assert(Value.Check(SessionDataSchema, sessionData2));
		assertEquals(sessionData2.identityId, identityId2);
	});

	await t.step("update", async () => {
		const sessionData = await session.create(
			ruid(IDENTITY_AUTOID_PREFIX),
			{},
		);
		await session.update({ ...sessionData!, meta: { foo: "bar" } });
		const sessionDataA = await session.get(sessionData!.id);
		assert(Value.Check(SessionDataSchema, sessionDataA));
		assertEquals(sessionDataA.meta, { foo: "bar" });
	});

	await t.step("get", async () => {
		const sessionData1a = await session.get(sessionData1!.id);
		assert(Value.Check(SessionDataSchema, sessionData1a));
		assertEquals(sessionData1a, sessionData1);

		await new Promise((r) => setTimeout(r, 1000));

		await assertRejects(() => session.get(sessionData2!.id));
	});

	await t.step("list", async () => {
		const sessionList = await session.list(identityId1);
		assertEquals(sessionList, [sessionData1!.id]);
	});

	await t.step("destroy", async () => {
		await session.destroy(sessionData1!.id);
		await assertRejects(() => session.get(sessionData1!.id));
	});
}
