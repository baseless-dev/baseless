import {
	assertEquals,
	assertRejects,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { SessionProvider } from "./session.ts";
import { autoid } from "../common/system/autoid.ts";
import { assertSessionData, SessionData } from "../common/session/data.ts";
import { assertResultError, unwrap } from "../common/system/result.ts";

export default async function testSessionProvider(
	session: SessionProvider,
	t: Deno.TestContext,
) {
	const identityId1 = autoid();
	const identityId2 = autoid();
	let sessionData1: SessionData | undefined;
	let sessionData2: SessionData | undefined;

	await t.step("create", async () => {
		sessionData1 = unwrap(await session.create(identityId1, {}));
		assertSessionData(sessionData1);
		assertEquals(sessionData1.identityId, identityId1);
	});

	await t.step("create with expiration", async () => {
		sessionData2 = unwrap(await session.create(identityId2, {}, 100));
		assertSessionData(sessionData2);
		assertEquals(sessionData2.identityId, identityId2);
	});

	await t.step("update", async () => {
		const sessionData = unwrap(await session.create(autoid(), {}));
		await session.update({ ...sessionData!, meta: { foo: "bar" } });
		const sessionDataA = unwrap(await session.get(sessionData!.id));
		assertSessionData(sessionDataA);
		assertEquals(sessionDataA.meta, { foo: "bar" });
	});

	await t.step("get", async () => {
		const sessionData1a = unwrap(await session.get(sessionData1!.id));
		assertSessionData(sessionData1a);
		assertEquals(sessionData1a, sessionData1);

		await new Promise((r) => setTimeout(r, 1000));

		assertResultError(await session.get(sessionData2!.id));
	});

	await t.step("list", async () => {
		const sessionList = unwrap(await session.list(identityId1));
		assertEquals(sessionList, [sessionData1]);
	});

	await t.step("destroy", async () => {
		await session.destroy(sessionData1!.id);
		assertResultError(await session.get(sessionData1!.id));
	});
}
