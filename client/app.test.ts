import {
	assert,
	assertEquals,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { assertApp, initializeApp } from "./app.ts";

Deno.test("Client App", async (t) => {
	await t.step("initializeApp", () => {
		const app = initializeApp({
			clientId: "test",
			apiEndpoint: "http://test.local/api",
		});
		assertApp(app);
		assertEquals(app.clientId, "test");
		assertEquals(app.apiEndpoint, "http://test.local/api");
		assert(typeof app.fetch === "function");
	});
});
