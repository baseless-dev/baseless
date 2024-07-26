import { assert } from "@std/assert";
import { Command, isCommand } from "./command.ts";
import { Value } from "@sinclair/typebox/value";

Deno.test("Command", async (t) => {
	await t.step("Command", () => {
		assert(
			Value.Check(Command, { kind: "command:rpc:invoke", rpc: ["foo", "bar"], input: "123" }),
		);
		assert(
			Value.Check(Command, {
				kind: "command:batched",
				commands: [{ kind: "command:rpc:invoke", rpc: ["foo", "bar"], input: "123" }],
			}),
		);
	});
	await t.step("isCommand", () => {
		assert(isCommand({ kind: "command:rpc:invoke", rpc: ["foo", "bar"], input: "123" }));
		assert(isCommand({ kind: "command:event:subscribe", event: ["foo", "bar"] }));
		assert(isCommand({ kind: "command:event:unsubscribe", event: ["foo", "bar"] }));
		assert(isCommand({ kind: "command:document:get", document: ["foo", "bar"] }));
		assert(isCommand({ kind: "command:document:set", document: ["foo", "bar"], value: "123" }));
		assert(isCommand({ kind: "command:document:delete", document: ["foo", "bar"] }));
		assert(
			isCommand({
				kind: "command:collection:list",
				collection: ["foo", "bar"],
				limit: 3,
				cursor: "abc",
			}),
		);
		assert(
			isCommand({ kind: "command:collection:get", collection: ["foo", "bar"], id: "abc" }),
		);
		assert(
			isCommand({
				kind: "command:collection:create",
				collection: ["foo", "bar"],
				value: "123",
			}),
		);
		assert(
			isCommand({
				kind: "command:collection:update",
				collection: ["foo", "bar"],
				id: "abc",
				value: "123",
			}),
		);
		assert(
			isCommand({ kind: "command:collection:delete", collection: ["foo", "bar"], id: "abc" }),
		);
		assert(isCommand({
			kind: "command:document:atomic",
			operations: [
				{ kind: "notExists", document: ["foo", "bar"] },
				{ kind: "set", document: ["foo", "bar"], value: "123" },
			],
		}));
		assert(
			isCommand({
				kind: "command:batched",
				commands: [{ kind: "command:rpc:invoke", rpc: ["foo", "bar"], input: "123" }],
			}),
		);
	});
});
