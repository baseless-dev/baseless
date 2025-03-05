import { Elysia, t, type TSchema } from "elysia";
import { Server } from "../server.ts";
import { TSchema } from "@baseless/core/schema";
import { Permission } from "../app.ts";

export default function elysia<TPrefix extends string = "">(baseless: Server, options?: { prefix?: TPrefix }): Elysia<TPrefix> {
	let app = new Elysia({
		name: "Baseless",
		prefix: options?.prefix,
	});

	const get = app.get.bind(app);
	const post = app.post.bind(app);

	for (const onRequest of baseless.onRequests) {
		const verb = onRequest.input.type === "void" ? get : post;
		app = verb(
			onRequest.path,
			(
				{ body, request, params, error }: {
					body: undefined | Record<string, unknown>;
					error: (code: number, message: string) => void;
					params: undefined | Record<string, string>;
					request: Request;
				},
			) => {
				try {
					return baseless.unsafe_handleRequest({
						handler: onRequest.handler,
						input: body,
						params: params ?? {},
						request,
						security: onRequest.security,
					});
				} catch (err) {
					if (typeof err === "string" && err === "FORBIDDEN") {
						return error(403, "Forbidden");
					}
					return error(500, "Internal Server Error");
				}
			},
			{
				body: schemaToTypebox(onRequest.input),
				response: schemaToTypebox(onRequest.output),
			},
		);
	}

	return app;
}

function schemaToTypebox(schema: TSchema): TSchema {
	function _schemaToTypebox(schema: TSchema, recursiveSchema: Record<string, any | undefined> = {}): TSchema {
		switch (schema.type) {
			case "id":
				return t.String({ ...schema, pattern: schema.prefix + ":[0-9a-f]{32}" });
			case "string":
				return t.String({ ...schema });
			case "number":
				return t.Number({ ...schema });
			case "boolean":
				return t.Boolean({ ...schema });
			case "null":
				return t.Null({ ...schema });
			case "unknown":
				return t.Unknown({ ...schema });
			case "any":
				return t.Any({ ...schema });
			case "void":
				return t.Void({ ...schema });
			case "literal":
				return t.Literal(schema.value, { ...schema });
			case "array":
				return t.Array(schemaToTypebox(schema.items), { ...schema });
			case "union":
				return t.Union(schema.types.map(schemaToTypebox), { ...schema });
			case "record":
				return t.Record(t.String(), schemaToTypebox(schema.value), { ...schema });
			case "object":
				return t.Object(
					Object.fromEntries(
						Object.entries(schema.properties).map((
							[key, value],
						) => [key, schema.required.includes(key) ? schemaToTypebox(value) : t.Optional(schemaToTypebox(value))]),
					),
				);
			case "recursive":
				return t.Recursive((self) => {
					return _schemaToTypebox(schema.value({ type: "self", schema: schema.identifier }), {
						...recursiveSchema,
						[schema.identifier]: self,
					});
				}, { ...schema });
			// deno-lint-ignore no-case-declarations
			case "self":
				const targetSchema = recursiveSchema[schema.schema];
				if (!targetSchema) {
					throw new Error("Invalid schema");
				}
				return targetSchema;
		}
	}
	return _schemaToTypebox(schema);
}
