import { assert } from "@std/assert";
import { Command, Commands, isCommand, isCommands } from "./command.ts";
import { Value } from "@sinclair/typebox/value";

Deno.test("Command", async (t) => {
	await t.step("Command", () => {
		assert(
			Value.Check(Command, { kind: "rpc", rpc: ["foo", "bar"], input: "123" }),
		);
		assert(
			Value.Check(Command, {
				kind: "document-atomic",
				checks: [{ type: "check", key: ["teams", "tid_Rfm6AWs3GUd4dz3xHPq9ZM"], versionstamp: null }],
				ops: [{
					type: "set",
					key: ["teams", "tid_Rfm6AWs3GUd4dz3xHPq9ZM"],
					data: {
						display: "Team A",
						teamId: "tid_Rfm6AWs3GUd4dz3xHPq9ZM",
						users: [{ userId: "id_vWMvMuXmZoZnS2YJQrjEkF", role: "owner" }],
					},
				}],
			}),
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
