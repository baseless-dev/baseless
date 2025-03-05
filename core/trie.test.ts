import { Trie } from "./trie.ts";
import { assertEquals } from "@std/assert/equals";

Deno.test("Trie", async (ctx) => {
	await ctx.step("insert & find", () => {
		const tree = new Trie<number>();
		tree.insert("a/b", 0);
		tree.insert("a/b/c", 1);
		tree.insert("a/b/c", 2);
		tree.insert("a/b/c", 3);
		tree.insert("posts/foobar", 4);
		tree.insert("posts/:postId", 5);
		tree.insert("posts/:pid", 6);
		assertEquals(Array.from(tree.find("a/b")), [[0, {}]]);
		assertEquals(Array.from(tree.find("a/b/c")), [[1, {}], [2, {}], [3, {}]]);
		assertEquals(Array.from(tree.find("posts/slug")), [[5, { postId: "slug" }], [6, { pid: "slug" }]]);
		assertEquals(Array.from(tree.find("posts/foobar")), [[4, {}], [5, { postId: "foobar" }], [6, { pid: "foobar" }]]);
	});
});
