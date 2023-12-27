import z from "npm:zod";
import { Type as f } from "https://esm.sh/@sinclair/typebox@0.31.28";
import { Value } from "https://esm.sh/@sinclair/typebox@0.31.28/value";
import { TypeCompiler } from "https://esm.sh/@sinclair/typebox@0.31.28/compiler";
import * as t from "./types.ts";
import { Check, CheckJIT, Compile } from "./schema.ts";

const zodSchema = z.object({
	id: z.string(),
	identification: z.string().optional(),
	confirmed: z.boolean(),
	meta: z.record(z.string()),
});

const ttSchema = f.Object({
	id: f.String(),
	identification: f.String(),
	confirmed: f.Boolean(),
	meta: f.Record(f.String(), f.String()),
}, ["id", "confirmed", "meta"]);

const ttSchemaCompiled = TypeCompiler.Compile(f.Object({
	id: f.String(),
	identification: f.String(),
	confirmed: f.Boolean(),
	meta: f.Record(f.String(), f.String()),
}, ["id", "confirmed", "meta"]));

const ourSchema = t.Object({
	id: t.String(),
	identification: t.String(),
	confirmed: t.Boolean(),
	meta: t.Record(t.String()),
}, ["id", "confirmed", "meta"]);

const ourSchemaCompiled = Compile(t.Object({
	id: t.String(),
	identification: t.String(),
	confirmed: t.Boolean(),
	meta: t.Record(t.String()),
}, ["id", "confirmed", "meta"]));

function isSchema(value: any): value is t.Infer<typeof ourSchema> {
	// Generated from Code(ourSchema)
	return typeof value === "object" && "id" in value && "confirmed" in value &&
		"meta" in value &&
		typeof value["id"] === "string" && "identification" in value &&
		typeof value["identification"] === "string" &&
		typeof value["confirmed"] === "boolean" &&
		typeof value["meta"] === "object" &&
		Object.values(value["meta"]).every((v) => typeof v === "string");
}

const data = {
	id: "id",
	identification: "email",
	confirmed: true,
	meta: {},
};

Deno.bench(
	"define schema with OUR",
	{ group: "define", baseline: true },
	() => {
		// deno-lint-ignore no-unused-vars
		const ourSchema = t.Object({
			id: t.String(),
			identification: t.String(),
			confirmed: t.Boolean(),
			meta: t.Record(t.String()),
		}, ["id", "confirmed", "meta"]);
	},
);

Deno.bench(
	"define schema with typebox",
	{ group: "define" },
	() => {
		// deno-lint-ignore no-unused-vars
		const ttSchema = f.Object({
			id: f.String(),
			identification: f.String(),
			confirmed: f.Boolean(),
			meta: f.Record(f.String(), f.String()),
		}, ["id", "confirmed", "meta"]);
	},
);

Deno.bench(
	"define schema with zod",
	{ group: "define" },
	() => {
		// deno-lint-ignore no-unused-vars
		const zodSchema = z.object({
			id: z.string(),
			identification: z.string().optional(),
			confirmed: z.boolean(),
			meta: z.record(z.string()),
		});
	},
);

Deno.bench(
	"check value against handcrafted typeguard",
	{ group: "check" },
	() => {
		isSchema(data);
	},
);

Deno.bench(
	"check value against OUR schema (jit)",
	{ group: "check" },
	() => {
		CheckJIT(ourSchema, data);
	},
);

Deno.bench(
	"check value against OUR schema (jit-first-then-aot)",
	{ group: "check" },
	() => {
		Check(ourSchema, data);
	},
);

Deno.bench(
	"check value against OUR schema (aot)",
	{ group: "check", baseline: true },
	() => {
		ourSchemaCompiled(data);
	},
);

Deno.bench(
	"check value against typebox schema (jit)",
	{ group: "check" },
	() => {
		Value.Check(ttSchema, data);
	},
);

Deno.bench(
	"check value against typebox schema (aot)",
	{ group: "check" },
	() => {
		ttSchemaCompiled.Check(data);
	},
);

Deno.bench(
	"check value against zod schema (jit)",
	{ group: "check" },
	() => {
		zodSchema.parse(data);
	},
);

Deno.bench(
	"compile OUR schema",
	{ group: "compile", baseline: true },
	() => {
		// deno-lint-ignore no-unused-vars
		const ourSchemaCompiled = Compile(t.Object({
			id: t.String(),
			identification: t.String(),
			confirmed: t.Boolean(),
			meta: t.Record(t.String()),
		}, ["id", "confirmed", "meta"]));
	},
);

Deno.bench(
	"compile typebox schema",
	{ group: "compile" },
	() => {
		// deno-lint-ignore no-unused-vars
		const ttSchemaCompiled = TypeCompiler.Compile(f.Object({
			id: f.String(),
			identification: f.String(),
			confirmed: f.Boolean(),
			meta: f.Record(f.String(), f.String()),
		}, ["id", "confirmed", "meta"]));
	},
);
