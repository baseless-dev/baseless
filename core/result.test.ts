import { assert } from "@std/assert";
import { isResult, Result } from "./result.ts";
import { Value } from "@sinclair/typebox/value";

Deno.test("Result", async (t) => {
	await t.step("Result", () => {
		assert(Value.Check(Result, { kind: "result:value", value: "42" }));
		assert(
			Value.Check(Result, {
				kind: "result:batched",
				results: [{ kind: "result:value", value: 42 }],
			}),
		);
	});
	await t.step("isResult", () => {
		assert(isResult({ kind: "result:value", value: "42" }));
		assert(isResult({ kind: "result:value", value: true }));
		assert(
			isResult({ kind: "result:batched", results: [{ kind: "result:value", value: 42 }] }),
		);
	});
});
