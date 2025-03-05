import { assert, assertEquals } from "@std/assert";
import { EventEmitter } from "./event_emitter.ts";

Deno.test("EventEmitter", async (t) => {
	await t.step("register", () => {
		new EventEmitter<{ foo: string }>();
	});

	await t.step("listen & emits", async () => {
		const emitter = new EventEmitter<{ foo: string }>();
		const stack: string[] = [];
		using listener = emitter.on("foo", (foo) => {
			stack.push(foo);
		});
		await emitter.emit("foo", "bar1");
		assertEquals(stack, ["bar1"]);
		await emitter.emit("foo", "bar2");
		assertEquals(stack, ["bar1", "bar2"]);
		listener[Symbol.dispose]();
		await emitter.emit("foo", "bar3");
		assertEquals(stack, ["bar1", "bar2"]);
	});

	await t.step("streams", async () => {
		const emitter = new EventEmitter<{ foo: string }>();
		const stream = emitter.stream("foo");
		await emitter.emit("foo", "bar1");
		await emitter.emit("foo", "bar2");
		await emitter.emit("foo", "bar3");
		const reader = stream.getReader();
		assertEquals(await reader.read(), { done: false, value: "bar1" });
		assertEquals(await reader.read(), { done: false, value: "bar2" });
		assertEquals(await reader.read(), { done: false, value: "bar3" });
		reader.releaseLock();
		stream.cancel();
		assert(!emitter.hasListener("foo"));
	});
});
