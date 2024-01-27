import { assertEquals, assertRejects } from "../deps.test.ts";
import { generateKey, hotp, totp } from "./otp.ts";

Deno.test("One Time Password", async (t) => {
	await t.step("generateKey", async () => {
		assertEquals((await generateKey(16)).length, 16);
		assertEquals((await generateKey(24)).length, 24);
	});

	await t.step("hotp", async () => {
		const key = await generateKey(16);
		const c1 = await hotp({ counter: 1, key, digits: 6 });
		const c2 = await hotp({ counter: 1, key, digits: 6 });
		assertEquals(c1, c2);
		await assertRejects(() => hotp({ counter: 1, key: "foo", digits: 6 }));
	});

	await t.step("totp", async () => {
		const key = await generateKey(16);
		const c1 = await totp({ time: 1, period: 30, key, digits: 6 });
		const c2 = await totp({ time: 1, period: 30, key, digits: 6 });
		assertEquals(c1, c2);
		await assertRejects(() =>
			totp({ time: 1, period: 30, key: "foo", digits: 6 })
		);
	});
});
