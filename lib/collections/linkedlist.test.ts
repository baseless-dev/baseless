import { assertEquals } from "https://deno.land/std@0.213.0/assert/mod.ts";
import { LinkedList } from "./linkedlist.ts";

Deno.test("DoubleLinkedList", async (t) => {
	await t.step("addLast/addFirst/contains/removeLast/removeFirst/clear", () => {
		const list = new LinkedList();
		list.addLast("a");
		list.addLast("b");
		list.addLast("c");
		assertEquals(list.size, 3);
		assertEquals(list.contains("a"), true);
		list.addFirst("d");
		assertEquals(list.size, 4);
		assertEquals(list.removeLast(), "c");
		assertEquals(list.removeFirst(), "d");
		assertEquals(list.size, 2);
		list.clear();
		assertEquals(list.size, 0);
	});
	await t.step("values/entries/forEach", () => {
		const list = new LinkedList<string>();
		list.addLast("a");
		list.addLast("b");
		list.addLast("c");
		assertEquals(Array.from(list.values()), ["a", "b", "c"]);
		const entries: Array<string> = [];
		list.forEach((value) => {
			entries.push(value);
		});
		assertEquals(entries, ["a", "b", "c"]);
	});
	await t.step(
		"findFirstNode/addBefore/findLastNode/addAfter/removeNode",
		() => {
			const list = new LinkedList<string>();
			list.addLast("a");
			list.addLast("b");
			list.addLast("c");
			list.addBefore(list.findFirstNode((v) => v === "b")!, "d");
			assertEquals(Array.from(list.values()), ["a", "d", "b", "c"]);
			list.addAfter(list.findLastNode((v) => v === "b")!, "e");
			assertEquals(Array.from(list.values()), ["a", "d", "b", "e", "c"]);
			list.removeNode(list.findLastNode((v) => v === "b")!);
			assertEquals(Array.from(list.values()), ["a", "d", "e", "c"]);
		},
	);
});
