import { assert } from "@std/assert";
import { isResult, Result } from "./result.ts";
import { Value } from "@sinclair/typebox/value";

Deno.test("Result", async (t) => {
	await t.step("Result", () => {
		assert(Value.Check(Result, { kind: "result", value: "42" }));
		assert(Value.Check(Result, { kind: "error", name: "DummyError" }));
		assert(Value.Check(Result, { kind: "unknown-error", error: "Blep" }));
		assert(
			Value.Check(Result, {
				kind: "results",
				results: [{ kind: "result", value: 42 }],
			}),
		);
	});
	await t.step("isResult", () => {
		assert(isResult({ kind: "result", value: "42" }));
		assert(isResult({ kind: "error", name: "DummyError" }));
		assert(isResult({ kind: "result", value: true }));
		assert(
			isResult({ kind: "results", results: [{ kind: "result", value: 42 }] }),
		);
	});
});
