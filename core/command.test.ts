import { assert } from "@std/assert";
import { Command, isCommand } from "./command.ts";
import { Value } from "@sinclair/typebox/value";

Deno.test("Command", async (t) => {
	await t.step("Command", () => {
		assert(
			Value.Check(Command, { kind: "command", rpc: ["foo", "bar"], input: "123" }),
		);
		assert(
			Value.Check(Command, {
				kind: "commands",
				commands: [{ kind: "command", rpc: ["foo", "bar"], input: "123" }],
			}),
		);
	});
	await t.step("isCommand", () => {
		assert(isCommand({ kind: "command", rpc: ["foo", "bar"], input: "123" }));
		assert(
			isCommand({
				kind: "commands",
				commands: [{ kind: "command", rpc: ["foo", "bar"], input: "123" }],
			}),
		);
	});
});
