import { assert, assertEquals } from "@std/assert";
import { createPathMatcher, mergeTreeNodes, pathToTreeNode } from "./path.ts";

Deno.test("Path", async (t) => {
	await t.step("pathToTreeNode", async () => {
		assertEquals(pathToTreeNode(["foo", "bar"]), {
			kind: "const",
			value: "foo",
			children: [{ kind: "const", value: "bar" }],
		});
		assertEquals(pathToTreeNode(["hello", "{world}"]), {
			kind: "const",
			value: "hello",
			children: [{ kind: "variable", name: "world" }],
		});
	});
	await t.step("mergeTreeNodes", async () => {
		assertEquals(
			mergeTreeNodes([
				pathToTreeNode(["users"]),
				pathToTreeNode(["users", "{id}"]),
				pathToTreeNode(["users", "{userId}", "edit"]),
				pathToTreeNode(["users", "{userid}", "delete"]),
			]),
			[
				{
					kind: "const",
					value: "users",
					children: [{
						kind: "variable",
						name: "id",
						children: [
							{ kind: "const", value: "delete" },
							{ kind: "const", value: "edit" },
						],
					}],
				},
			],
		);
	});
	await t.step("createPathMatcher", async () => {
		const matcher = createPathMatcher([
			{ path: ["users"], id: 1 },
			{ path: ["users", "{id}"], id: 2 },
			{ path: ["users", "{userId}", "delete"], id: 3 },
			{ path: ["users", "{user_id}", "edit"], id: 4 },
		]);
		assertEquals(matcher(["users"]), {
			path: ["users"],
			id: 1,
		});
		assertEquals(matcher(["users", "123"]), {
			path: ["users", "{id}"],
			id: 2,
		});
		assertEquals(matcher(["users", "123", "delete"]), {
			path: ["users", "{userId}", "delete"],
			id: 3,
		});
	});
});
