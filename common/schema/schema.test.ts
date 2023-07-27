import { assertThrows } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { assertSchema, type Infer } from "./types.ts";
import * as s from "./schema.ts";
import * as v from "./validator.ts";
import { autoid, isAutoId } from "../system/autoid.ts";

Deno.test("schema", async (t) => {
	await t.step("assert string", () => {
		const testSchema = s.string();
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, "foo");
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert lazy", () => {
		const testSchema = s.lazy(() => s.string());
		type Test = Infer<typeof testSchema>;
		// assertSchema(testSchema, "foo");
		// assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert optional", () => {
		const testSchema = s.optional(s.string());
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, "foo");
		assertSchema(testSchema, undefined);
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert literal", () => {
		const testSchema = s.literal("foo");
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, "foo");
		assertThrows(() => assertSchema(testSchema, "bob"));
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert choice", () => {
		const testSchema = s.choice(["foo", "bar"]);
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, "foo");
		assertThrows(() => assertSchema(testSchema, "bob"));
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert array", () => {
		const testSchema = s.array(s.string());
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, ["foo", "bar"]);
		assertThrows(() => assertSchema(testSchema, ["foo", 42]));
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert record", () => {
		const testSchema = s.record(s.string());
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, { a: "b" });
		assertThrows(() => assertSchema(testSchema, { a: 1 }));
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert object", () => {
		const testSchema = s.object(
			{
				a: s.string(),
			},
		);
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, { a: "a" });
		assertThrows(() => assertSchema(testSchema, { a: 1 }));
		assertThrows(() => assertSchema(testSchema, { a: "a", b: "b" }));
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert union", () => {
		const testSchema = s.union([s.string(), s.number(), s.nill()]);
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, "foo");
		assertSchema(testSchema, 42);
		assertSchema(testSchema, null);
		assertThrows(() => assertSchema(testSchema, true));
	});
	await t.step("assert complex", () => {
		const userSchema = s.object({
			id: s.string([
				v.match((v) => isAutoId(v, "id-")),
			]),
			username: s.string(
				[v.minLength(4), v.maxLength(32)],
			),
			gender: s.choice(["male", "female", "non-binary"]),
			age: s.optional(s.number([v.gte(18)])),
		});
		type Test = Infer<typeof userSchema>;

		assertSchema(userSchema, {
			id: autoid("id-"),
			username: "boby",
			gender: "male",
		});

		assertThrows(() =>
			assertSchema(userSchema, {
				id: autoid("id-"),
				username: "boby",
				gender: "not your god damn business",
			})
		);

		assertThrows(() =>
			assertSchema(userSchema, {
				id: autoid("id-"),
				username: "boby",
				gender: "male",
				age: 14,
			})
		);

		// try {
		// 	assertSchema(userSchema, {
		// 		id: autoid("id-"),
		// 		username: "boby",
		// 		gender: "male",
		// 		age: 14,
		// 	});
		// } catch (error) {
		// 	throw error;
		// }
	});
});
