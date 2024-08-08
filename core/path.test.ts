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
			value: {
				path: ["users"],
				id: 1,
			},
			params: {},
		});
		assertEquals(matcher(["users", "123"]), {
			value: {
				path: ["users", "{id}"],
				id: 2,
			},
			params: { id: "123" },
		});
		assertEquals(matcher(["users", "123", "delete"]), {
			value: {
				path: ["users", "{userId}", "delete"],
				id: 3,
			},
			params: { userId: "123" },
		});
	});
});
