import { assertEquals } from "@std/assert";
import { stableStringify } from "./stable_stringify.ts";

Deno.test("Stable Stringify", () => {
	class A {
		a = "A";
	}
	class B {
		b = "B";
		toJSON(): string {
			return "B";
		}
	}
	assertEquals(stableStringify(1), `1`);
	assertEquals(stableStringify(1n.toString()), `"1"`);
	assertEquals(stableStringify("foo"), `"foo"`);
	assertEquals(stableStringify(true), `true`);
	assertEquals(stableStringify(false), `false`);
	assertEquals(stableStringify(null), `null`);
	assertEquals(stableStringify(undefined), undefined);
	// assertEquals(
	// 	stableStringify(new Date(2018, 11, 25, 22, 55, 0, 0)),
	// 	`"2018-12-26T03:55:00.000Z"`,
	// );
	assertEquals(stableStringify({ foo: "bar" }), `{"foo":"bar"}`);
	assertEquals(stableStringify(new A()), `{"a":"A"}`);
	assertEquals(stableStringify(new B()), `"B"`);
	assertEquals(stableStringify({ a: "A", b: "B" }), `{"a":"A","b":"B"}`);
	assertEquals(stableStringify({ b: "B", a: "A" }), `{"a":"A","b":"B"}`);
	assertEquals(stableStringify([1, "2", true]), `[1,"2",true]`);
});
