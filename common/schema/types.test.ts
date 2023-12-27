import * as t from "./types.ts";
import type { Infer } from "./types.ts";

Deno.test("types", () => {
	const _t1 = t.Null();
	const _t2 = t.Boolean();
	const _t3 = t.Number();
	const _t4 = t.String();
	const _t5 = t.Enum("a", "b", "c");
	const _t6 = t.Const(1);
	const _t7 = t.Tuple([t.Null(), t.Number()]);
	const _t8 = t.Array(t.Number());
	const _t9 = t.Object({ a: t.Number(), b: t.String() }, ["a"]);
	const _t10 = t.Record(t.Number());
	const _t11 = t.Union(t.Number(), t.String(), t.Const("foo"));

	type B = Infer<typeof _t11>;
});
