import { assertEquals } from "@std/assert";
import { createPathMatcher, mergeTreeNodes, pathToTreeNode } from "./path.ts";

Deno.test("Path", async (t) => {
	await t.step("pathToTreeNode", () => {
		assertEquals(pathToTreeNode(["foo", "bar"]), {
			kind: "const",
			value: "foo",
			children: [{
				kind: "const",
				value: "bar",
				children: [{ kind: "leaf", values: [undefined] }],
			}],
		});
		assertEquals(pathToTreeNode(["hello", "{world}"]), {
			kind: "const",
			value: "hello",
			children: [{
				kind: "variable",
				name: "world",
				children: [{ kind: "leaf", values: [undefined] }],
			}],
		});
	});
	await t.step("mergeTreeNodes", () => {
		assertEquals(
			mergeTreeNodes([
				pathToTreeNode(["users"], 1),
				pathToTreeNode(["users", "{id}"], 2),
				pathToTreeNode(["users", "{userId}", "edit"], 3),
				pathToTreeNode(["users", "{userid}", "delete"], 4),
				pathToTreeNode(["users", "{user_id}"], 5),
			]),
			[
				{
					kind: "const",
					value: "users",
					children: [
						{
							kind: "variable",
							name: "id",
							children: [
								{
									kind: "const",
									value: "delete",
									children: [{ kind: "leaf", values: [4] }],
								},
								{
									kind: "const",
									value: "edit",
									children: [{ kind: "leaf", values: [3] }],
								},
								{ kind: "leaf", values: [2, 5] },
							],
						},
						{ kind: "leaf", values: [1] },
					],
				},
			],
		);
	});
	await t.step("createPathMatcher", () => {
		const matcher = createPathMatcher([
			{ path: ["users"], id: 1 },
			{ path: ["users", "{id}"], id: 2 },
			{ path: ["users", "{userId}", "delete"], id: 3 },
			{ path: ["users", "{user_id}", "edit"], id: 4 },
			{ path: ["users", "{user_id}"], id: 5 },
		]);
		assertEquals(
			Array.from(matcher(["users"])),
			[{ path: ["users"], id: 1 }],
		);
		assertEquals(
			Array.from(matcher(["users", "123"])),
			[{ path: ["users", "{id}"], id: 2 }, { path: ["users", "{user_id}"], id: 5 }],
		);
		assertEquals(
			Array.from(matcher(["users", "123", "delete"])),
			[{ path: ["users", "{userId}", "delete"], id: 3 }],
		);
		assertEquals(
			Array.from(matcher(["users", "123", "foo"])),
			[],
		);
		assertEquals(
			Array.from(matcher(["not", "found"])),
			[],
		);
	});
});
