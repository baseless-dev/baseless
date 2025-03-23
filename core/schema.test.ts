import { assert, assertEquals, assertFalse } from "@std/assert";
import * as t from "./schema.ts";
import { SchemaValidationError } from "./schema.ts";

Deno.test("schema", async (ctx) => {
	await ctx.step("generate Typescript from schema", () => {
		assertEquals(t.generateTypescriptFromSchema(t.String())[1], `string`);
		assertEquals(t.generateTypescriptFromSchema(t.Number())[1], `number`);
		assertEquals(t.generateTypescriptFromSchema(t.Boolean())[1], `boolean`);
		assertEquals(t.generateTypescriptFromSchema(t.Null())[1], `null`);
		assertEquals(t.generateTypescriptFromSchema(t.Any())[1], `any`);
		assertEquals(t.generateTypescriptFromSchema(t.Unknown())[1], `unknown`);
		assertEquals(t.generateTypescriptFromSchema(t.Void())[1], `void`);
		assertEquals(t.generateTypescriptFromSchema(t.Literal("42"))[1], `"42"`);
		assertEquals(t.generateTypescriptFromSchema(t.Array(t.String()))[1], `Array<string>`);
		assertEquals(t.generateTypescriptFromSchema(t.Union([t.String(), t.Number()]))[1], `string | number`);
		assertEquals(
			t.generateTypescriptFromSchema(t.Object({ foo: t.String(), bar: t.Number() }, ["foo"]))[1],
			`{foo: string; bar?: number}`,
		);
		assertEquals(t.generateTypescriptFromSchema(t.Record(t.Number()))[1], `{[key: string]: number}`);
		assertEquals(
			t.generateTypescriptFromSchema(
				t.Recursive((self) => t.Union([t.String(), t.Number(), t.Boolean(), t.Array(self), t.Record(self)]), "JSONValue"),
			),
			[new Map([["JSONValue", "string | number | boolean | Array<JSONValue> | {[key: string]: JSONValue}"]]), "JSONValue"],
		);
	});

	await ctx.step("generate schema type from schema", () => {
		assertEquals(t.generateSchemaFromSchema(t.String()), `Type.TString`);
		assertEquals(t.generateSchemaFromSchema(t.Number()), `Type.TNumber`);
		assertEquals(t.generateSchemaFromSchema(t.Boolean()), `Type.TBoolean`);
		assertEquals(t.generateSchemaFromSchema(t.Null()), `Type.TNull`);
		assertEquals(t.generateSchemaFromSchema(t.Any()), `Type.TAny`);
		assertEquals(t.generateSchemaFromSchema(t.Unknown()), `Type.TUnknown`);
		assertEquals(t.generateSchemaFromSchema(t.Void()), `Type.TVoid`);
		assertEquals(t.generateSchemaFromSchema(t.Literal("42")), `Type.TLiteral<"42">`);
		assertEquals(t.generateSchemaFromSchema(t.Array(t.String())), `Type.TArray<Type.TString>`);
		assertEquals(t.generateSchemaFromSchema(t.Union([t.String(), t.Number()])), `Type.TUnion<[Type.TString, Type.TNumber]>`);
		assertEquals(
			t.generateSchemaFromSchema(t.Object({ foo: t.String(), bar: t.Number() }, ["foo"])),
			`Type.TObject<{foo: Type.TString; bar: Type.TNumber}, ["foo"]>`,
		);
		assertEquals(t.generateSchemaFromSchema(t.Record(t.Number())), `Type.TRecord<Type.TNumber>`);
		assertEquals(
			t.generateSchemaFromSchema(
				t.Recursive((self) => t.Union([t.String(), t.Number(), t.Boolean(), t.Array(self), t.Record(self)]), "JSONValue"),
			),
			`Type.TRecursive<Type.TUnion<[Type.TString, Type.TNumber, Type.TBoolean, Type.TArray<Type.TSelf<"JSONValue">>, Type.TRecord<Type.TSelf<"JSONValue">>]>, "JSONValue">`,
		);
	});

	await ctx.step("validate", () => {
		const errors: SchemaValidationError[] = [];
		assert(t.validate(t.String(), ""));
		assert(t.validate(t.Number(), 42));
		assert(t.validate(t.Boolean(), false));
		assert(t.validate(t.Null(), null));
		assert(t.validate(t.Any(), Date));
		assert(t.validate(t.Unknown(), undefined));
		assert(t.validate(t.Literal(42), 42));
		assert(t.validate(t.Array(t.String()), [""]));
		assert(t.validate(t.Union([t.String(), t.Number()]), ""));
		assert(t.validate(t.Object({ foo: t.String(), bar: t.Number() }, ["foo"]), { foo: "" }));
		assert(t.validate(t.Object({ foo: t.String(), bar: t.Number() }, ["foo"], { additionalProperties: true }), { foo: "", absent: 0 }));
		assertFalse(
			t.validate(t.Object({ foo: t.String(), bar: t.Number() }, ["foo"], { additionalProperties: false }), { foo: "", absent: 0 }, errors),
		);
		assertEquals(errors.length, 2);
		assertFalse(t.validate(t.Object({ foo: t.String(), bar: t.Number() }, ["foo"]), { bar: 42 }, errors));
		assertEquals(errors.length, 2);
		assert(t.validate(t.Record(t.Number()), { foo: 42 }));
		assert(
			t.validate(
				t.Recursive((self) => t.Union([t.String(), t.Number(), t.Boolean(), t.Null(), t.Array(self), t.Record(self)]), "JSONValue"),
				[
					"",
					42,
					true,
					null,
					{ foo: "", bar: 42 },
				],
			),
		);
	});

	await ctx.step("toObject", () => {
		assertEquals(t.toObject(t.String()), { "type": "string" });
		assertEquals(
			t.toObject(
				t.Recursive((self) => t.Union([t.String(), t.Number(), t.Boolean(), t.Null(), t.Array(self), t.Record(self)]), "JSONValue"),
			),
			{
				"type": "recursive",
				"identifier": "JSONValue",
				"value": {
					"type": "union",
					"types": [{ "type": "string" }, { "type": "number" }, { "type": "boolean" }, { "type": "null" }, {
						"type": "array",
						"items": { "type": "self", "identifier": "JSONValue" },
					}, { "type": "record", "value": { "type": "self", "identifier": "JSONValue" } }],
				},
			},
		);
	});

	await ctx.step("fromObject", () => {
		assertEquals(t.fromObject({ "type": "string" }), t.String());
		assertEquals(
			t.toObject(t.fromObject(
				{
					"type": "recursive",
					"identifier": "JSONValue",
					"value": {
						"type": "union",
						"types": [{ "type": "string" }, { "type": "number" }, { "type": "boolean" }, { "type": "null" }, {
							"type": "array",
							"items": { "type": "self", "identifier": "JSONValue" },
						}, { "type": "record", "value": { "type": "self", "identifier": "JSONValue" } }],
					},
				},
			)),
			t.toObject(
				t.Recursive((self) => t.Union([t.String(), t.Number(), t.Boolean(), t.Null(), t.Array(self), t.Record(self)]), "JSONValue"),
			),
		);
	});
});
