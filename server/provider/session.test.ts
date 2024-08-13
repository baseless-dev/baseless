import { id } from "@baseless/core/id";
import { SessionProvider } from "./session.ts";
import { assertEquals, assertRejects } from "@std/assert";

export async function testSessionProvider(
	session: SessionProvider,
	t: Deno.TestContext,
): Promise<void> {
	const a = id("sess_");
	const b = id("sess_");
	await t.step("set", async () => {
		await session.set({
			sessionId: a,
			identityId: id("id_"),
			data: { foo: "bar" },
		});
		await session.set({
			sessionId: b,
			identityId: id("id_"),
			data: { bar: "foo" },
		}, 10);
	});

	await t.step("get", async () => {
		assertEquals((await session.get(a)).data, { foo: "bar" });
		assertEquals((await session.get(b)).data, { bar: "foo" });
		await assertRejects(() => session.get(id("sess_")));
		await new Promise((r) => setTimeout(r, 100));
		await assertRejects(() => session.get(b));
	});

	await t.step("delete", async () => {
		await session.delete(a);
		await session.delete(id("sess_"));
	});
}
