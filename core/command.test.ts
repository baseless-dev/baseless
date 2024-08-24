import { assert } from "@std/assert";
import { Command, Commands, isCommand, isCommands } from "./command.ts";
import { Value } from "@sinclair/typebox/value";

Deno.test("Command", async (t) => {
	await t.step("Command", () => {
		assert(
			Value.Check(Command, { kind: "rpc", rpc: ["foo", "bar"], input: "123" }),
		);
		assert(
			Value.Check(Commands, {
				kind: "commands",
				commands: [{ kind: "rpc", rpc: ["foo", "bar"], input: "123" }],
			}),
		);
	});
	await t.step("isCommand", () => {
		assert(isCommand({ kind: "rpc", rpc: ["foo", "bar"], input: "123" }));
		assert(
			isCommands({
				kind: "commands",
				commands: [{ kind: "rpc", rpc: ["foo", "bar"], input: "123" }],
			}),
		);
	});
});
