import {
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { autoid } from "../../shared/autoid.ts";
import { assertSessionData, SessionData, SessionProvider } from "./session.ts";

export default async function testSessionProvider(
	session: SessionProvider,
	t: Deno.TestContext,
) {
	const identityId1 = autoid();
	const identityId2 = autoid();
	let sessionData1: SessionData | undefined;
	let sessionData2: SessionData | undefined;

	await t.step("create", async () => {
		sessionData1 = await session.create(identityId1, {});
		assertSessionData(sessionData1);
		assertEquals(sessionData1.identityId, identityId1);
	});

	await t.step("create with expiration", async () => {
		sessionData2 = await session.create(identityId2, {}, 100);
		assertSessionData(sessionData2);
		assertEquals(sessionData2.identityId, identityId2);
	});

	await t.step("update", async () => {
		const sessionData = await session.create(autoid(), {});
		await session.update({ ...sessionData!, meta: { foo: "bar" } });
		const sessionDataA = await session.get(sessionData!.id);
		assertSessionData(sessionDataA);
		assertEquals(sessionDataA.meta, { foo: "bar" });
	});

	await t.step("get", async () => {
		const sessionData1a = await session.get(sessionData1!.id);
		assertSessionData(sessionData1a);
		assertEquals(sessionData1a, sessionData1);

		await new Promise((r) => setTimeout(r, 1000));

		await assertRejects(() => session.get(sessionData2!.id));
	});

	await t.step("list", async () => {
		const sessionList = await session.list(identityId1);
		assertEquals(sessionList, [sessionData1]);
	});

	await t.step("destroy", async () => {
		await session.destroy(sessionData1!.id);
		await assertRejects(() => session.get(sessionData1!.id));
	});
}
