import { assertEquals } from "@std/assert";
import { EventEmitter } from "./eventemitter.ts";

Deno.test("EventEmitter", async (t) => {
	await t.step("register", () => {
		new EventEmitter().register<"foo", [foo: string]>();
	});

	await t.step("listen & emits", async () => {
		const emitter = new EventEmitter().register<"foo", [foo: string]>();
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
});
