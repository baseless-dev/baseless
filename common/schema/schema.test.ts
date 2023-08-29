import { assertThrows } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { assertSchema, type Infer } from "./types.ts";
import * as s from "./schema.ts";
import * as v from "./validator.ts";
import { autoid } from "../system/autoid.ts";

Deno.test("schema", async (t) => {
	await t.step("assert nill", () => {
		const testSchema = s.nill();
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, null);
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert undef", () => {
		const testSchema = s.undef();
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, undefined);
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert unknown", () => {
		const testSchema = s.unknown();
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, undefined);
		assertSchema(testSchema, null);
		assertSchema(testSchema, {});
		assertSchema(testSchema, 0);
		assertSchema(testSchema, 1);
		assertSchema(testSchema, "");
		assertSchema(testSchema, new Date());
	});
	await t.step("assert string", () => {
		const testSchema = s.string();
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, "foo");
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert autoid", () => {
		{
			const testSchema = s.autoid();
			type Test = Infer<typeof testSchema>;
			assertSchema(testSchema, autoid());
			assertThrows(() => assertSchema(testSchema, ""));
		}
		{
			const testSchema = s.autoid("foo_");
			assertSchema(testSchema, autoid("foo_"));
			assertThrows(() => assertSchema(testSchema, autoid("bar_")));
		}
	});
	await t.step("assert number", () => {
		const testSchema = s.number();
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, 42);
		assertThrows(() => assertSchema(testSchema, ""));
	});
	await t.step("assert boolean", () => {
		const testSchema = s.boolean();
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, true);
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert func", () => {
		const testSchema = s.func<[a: string, b: number], void | Promise<void>>();
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, () => {});
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert date", () => {
		const testSchema = s.date();
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, new Date());
		assertThrows(() => assertSchema(testSchema, {}));
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert lazy", () => {
		const testSchema = s.lazy(() => s.string());
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, "foo");
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
		const testSchema = s.record(s.nill());
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, { a: null });
		assertThrows(() => assertSchema(testSchema, { a: 1 }));
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert object", () => {
		{
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
		}
		{
			const testSchema = s.object(
				{
					a: s.string(),
					b: s.string(),
				},
				["b"],
			);
			type Test = Infer<typeof testSchema>;
			assertSchema(testSchema, { a: "a" });
			assertSchema(testSchema, { a: "a", b: "b" });
			assertThrows(() => assertSchema(testSchema, { a: 1 }));
			assertThrows(() => assertSchema(testSchema, { a: "a", b: 1 }));
		}
	});
	await t.step("assert union", () => {
		{
			const testSchema = s.union([s.string(), s.number(), s.nill()]);
			type Test = Infer<typeof testSchema>;
			assertSchema(testSchema, "foo");
			assertSchema(testSchema, 42);
			assertSchema(testSchema, null);
			assertThrows(() => assertSchema(testSchema, true));
		}
		{
			const testSchema = s.union([
				s.object({ foo: s.string() }),
				s.object({ bar: s.number() }),
			]);
			type Test = Infer<typeof testSchema>;
			assertSchema(testSchema, { foo: "" });
			assertSchema(testSchema, { bar: 42 });
			assertThrows(() => assertSchema(testSchema, { foo: 42 }));
			assertThrows(() => assertSchema(testSchema, { bar: "" }));
		}
	});
	await t.step("assert tuple", () => {
		const testSchema = s.tuple([s.string(), s.number(), s.literal("foo")]);
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, ["a", 42, "foo"]);
		assertThrows(() => assertSchema(testSchema, "a"));
		assertThrows(() => assertSchema(testSchema, [42, "b", "bar"]));
		assertThrows(() => assertSchema(testSchema, ["a", "b", "bar"]));
		assertThrows(() => assertSchema(testSchema, ["a", 42, "bar"]));
	});
	await t.step("assert partial", () => {
		const testSchema = s.partial(s.object(
			{
				a: s.string(),
			},
		));
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, { a: "a" });
		assertSchema(testSchema, {});
		assertThrows(() => assertSchema(testSchema, { a: 1 }));
		assertThrows(() => assertSchema(testSchema, { b: "b" }));
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert describe", () => {
		const testSchema = s.describe(
			{ description: "A description" },
			s.string(),
		);
		type Test = Infer<typeof testSchema>;
		assertSchema(testSchema, "foo");
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert complex", () => {
		const testSchema = s.describe(
			{ label: "User" },
			s.object({
				id: s.describe({ label: "ID" }, s.autoid("id_")),
				username: s.describe(
					{ label: "Username" },
					s.string(
						[v.minLength(4), v.maxLength(32)],
					),
				),
				gender: s.describe(
					{ label: "Gender" },
					s.union([
						s.literal("binary"),
						s.literal("non-binary"),
						s.literal(69),
					]),
				),
				age: s.describe(
					{ label: "Age" },
					s.number([v.gte(18, "Must be 18 or older")]),
				),
			}, ["age"]),
		);
		// console.log(Deno.inspect(testSchema, { depth: 10 }));
		type Test = Infer<typeof testSchema>;

		assertSchema(testSchema, {
			id: autoid("id_"),
			username: "boby",
			gender: "binary",
		});

		assertThrows(() =>
			assertSchema(testSchema, {
				id: autoid("id_"),
				username: "boby",
				gender: "not your god damn business",
			})
		);

		assertThrows(() =>
			assertSchema(testSchema, {
				id: autoid("id_"),
				username: "boby",
				gender: "binary",
				age: 14,
			})
		);
	});
});