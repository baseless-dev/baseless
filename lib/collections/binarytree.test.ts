import { assertEquals } from "https://deno.land/std@0.213.0/assert/mod.ts";
import { BinaryTree } from "./binarytree.ts";

Deno.test("BinaryTree", async (t) => {
	await t.step("add/remove/clear", () => {
		const tree = new BinaryTree();
		tree.add("a");
		tree.add("b");
		tree.add("c");
		assertEquals(tree.size, 3);
		assertEquals(tree.contains("a"), true);
		tree.remove("b");
		assertEquals(tree.size, 2);
		assertEquals(tree.contains("b"), false);
		tree.clear();
		assertEquals(tree.size, 0);
	});
	await t.step("values/forEach", () => {
		const tree = new BinaryTree();
		tree.add("b");
		tree.add("a");
		tree.add("c");
		assertEquals(Array.from(tree.values()), ["b", "a", "c"]);
		tree.remove("b");
		assertEquals(Array.from(tree.values()), ["a", "c"]);
	});
});
