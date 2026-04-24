import { assertRejects } from "@std/assert/rejects";
import { assertEquals } from "@std/assert/equals";
import { app } from "../app.ts";
import * as z from "@baseless/core/schema";
import { Response as TypedResponse } from "@baseless/core/response";
import type { OpenAPIV3 } from "openapi-types";
import documentApp from "./document.ts";
import {
	createOpenAPIDocument,
	endpointsDefinitionToOpenAPI,
	zodRequestToOpenAPIPathsObject,
	zodSchemaToOpenAPISchema,
} from "./openapi.ts";

Deno.test("OpenAPI", async (t) => {
	await t.step("convert builtin zod to OpenAPI schema", async () => {
		const schema = z.object({
			name: z.string(),
			userId: z.id("usr_"),
			age: z.number().int().optional(),
			tags: z.array(z.string()),
			role: z.enum(["admin", "user"]),
			active: z.boolean(),
			nickname: z.literal("neo"),
			bio: z.nullable(z.string()),
		});

		assertEquals(zodSchemaToOpenAPISchema(schema), {
			type: "object",
			properties: {
				name: { type: "string" },
				userId: {
					type: "string",
					pattern: "^usr_[0-9A-Za-z]{26}$",
					minLength: 30,
					maxLength: 30,
				},
				age: {
					type: "integer",
					minimum: Number.MIN_SAFE_INTEGER,
					maximum: Number.MAX_SAFE_INTEGER,
				},
				tags: {
					type: "array",
					items: { type: "string" },
				},
				role: {
					type: "string",
					enum: ["admin", "user"],
				},
				active: { type: "boolean" },
				nickname: {
					type: "string",
					enum: ["neo"],
				},
				bio: {
					type: "string",
					nullable: true,
				},
			},
			required: ["name", "userId", "tags", "role", "active", "nickname", "bio"],
			additionalProperties: false,
		});

		await assertRejects(
			() => Promise.resolve().then(() => zodSchemaToOpenAPISchema(z.custom<string>(() => true))),
			TypeError,
			"Only JSON-schema-compatible Zod schemas can be converted to OpenAPI for now",
		);
	});

	await t.step("convert nested custom schemas inside builtin zod schema", () => {
		const schema = z.object({
			attachment: z.readableStream(),
			preview: z.nullable(z.readableStream()),
			uploads: z.array(z.readableStream()),
			payload: z.formData({
				avatar: z.file(),
				name: z.string(),
			}),
		});

		assertEquals(zodSchemaToOpenAPISchema(schema), {
			type: "object",
			properties: {
				attachment: {
					type: "string",
					format: "binary",
				},
				preview: {
					type: "string",
					format: "binary",
					nullable: true,
				},
				uploads: {
					type: "array",
					items: {
						type: "string",
						format: "binary",
					},
				},
				payload: {
					type: "object",
					properties: {
						avatar: {
							type: "string",
							format: "binary",
						},
						name: { type: "string" },
					},
					required: ["avatar", "name"],
					additionalProperties: false,
				},
			},
			required: ["attachment", "preview", "uploads", "payload"],
			additionalProperties: false,
		});
	});

	await t.step("convert document app endpoints with nested instanceof schemas", () => {
		const document = createOpenAPIDocument(documentApp.build(), {
			info: {
				title: "Document",
				version: "0.0.0",
			},
		});

		assertEquals(
			(document.paths["/document/get"] as OpenAPIV3.PathItemObject).post?.requestBody,
			{
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								path: { type: "string" },
								options: {
									type: "object",
									properties: {
										consistency: {
											anyOf: [
												{ type: "string", enum: ["strong"] },
												{ type: "string", enum: ["eventual"] },
											],
										},
										signal: {},
									},
									required: ["consistency"],
									additionalProperties: false,
								},
							},
							required: ["path"],
							additionalProperties: false,
						},
					},
				},
			},
		);

		assertEquals(
			(document.paths["/document/list"] as OpenAPIV3.PathItemObject).post?.requestBody,
			{
				required: true,
				content: {
					"application/json": {
						schema: {
							type: "object",
							properties: {
								options: {
									type: "object",
									properties: {
										prefix: { type: "string" },
										cursor: { type: "string" },
										limit: { type: "number" },
										signal: {},
									},
									required: ["prefix"],
									additionalProperties: false,
								},
							},
							required: ["options"],
							additionalProperties: false,
						},
					},
				},
			},
		);
	});

	await t.step("convert custom zod request to OpenAPI paths", () => {
		const request = z.request({
			summary: "Create user",
			description: "Creates a user from a JSON payload.",
			method: "POST",
			headers: {
				authorization: z.string(),
				"content-type": z.literal("application/json"),
			},
			searchParams: {
				accountId: z.string(),
				trace: z.string().optional(),
			},
			body: z.object({
				userId: z.id("usr_"),
				name: z.string(),
			}),
		});
		const response = z.union([
			z.response({
				status: 201,
				description: "Created user",
				headers: {
					"content-type": z.literal("application/json"),
					etag: z.string().optional(),
				},
				body: z.object({
					userId: z.id("usr_"),
					name: z.string(),
				}),
			}),
			z.response({
				status: 201,
				description: "Created user",
				headers: {
					"content-type": z.literal("text/plain"),
				},
				body: z.string(),
			}),
			z.response({
				status: 400,
				description: "Invalid input",
				headers: {
					"content-type": z.literal("application/json"),
				},
				body: z.object({
					error: z.string(),
				}),
			}),
		]);

		assertEquals(
			zodRequestToOpenAPIPathsObject("users/:userId", request, response),
			{
				"/users/{userId}": {
					post: {
						summary: "Create user",
						description: "Creates a user from a JSON payload.",
						parameters: [
							{
								name: "authorization",
								in: "header",
								required: true,
								schema: { type: "string" },
							},
							{
								name: "accountId",
								in: "query",
								required: true,
								schema: { type: "string" },
							},
							{
								name: "trace",
								in: "query",
								required: false,
								schema: { type: "string" },
							},
						],
						requestBody: {
							required: true,
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											userId: {
												type: "string",
												pattern: "^usr_[0-9A-Za-z]{26}$",
												minLength: 30,
												maxLength: 30,
											},
											name: { type: "string" },
										},
										required: ["userId", "name"],
										additionalProperties: false,
									},
								},
							},
						},
						responses: {
							"201": {
								description: "Created user",
								headers: {
									etag: {
										schema: { type: "string" },
									},
								},
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: {
												userId: {
													type: "string",
													pattern: "^usr_[0-9A-Za-z]{26}$",
													minLength: 30,
													maxLength: 30,
												},
												name: { type: "string" },
											},
											required: ["userId", "name"],
											additionalProperties: false,
										},
									},
									"text/plain": {
										schema: { type: "string" },
									},
								},
							},
							"400": {
								description: "Invalid input",
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: {
												error: { type: "string" },
											},
											required: ["error"],
											additionalProperties: false,
										},
									},
								},
							},
						},
					},
				},
			},
		);
	});

	await t.step("convert formData request body to OpenAPI schema", () => {
		const request = z.request({
			method: "POST",
			body: z.formData({
				avatar: z.file(),
				name: z.string(),
			}),
		});

		assertEquals(zodRequestToOpenAPIPathsObject("users/upload", request), {
			"/users/upload": {
				post: {
					requestBody: {
						required: true,
						content: {
							"multipart/form-data": {
								schema: {
									type: "object",
									properties: {
										avatar: {
											type: "string",
											format: "binary",
										},
										name: { type: "string" },
									},
									required: ["avatar", "name"],
									additionalProperties: false,
								},
							},
						},
					},
					responses: {},
				},
			},
		});
	});

	await t.step("convert readableStream bodies to OpenAPI schema", () => {
		const request = z.request({
			method: "POST",
			body: z.readableStream(),
		});
		const response = z.response({
			status: 200,
			headers: {
				"content-type": z.literal("application/pdf"),
			},
			body: z.readableStream(),
		});

		assertEquals(zodRequestToOpenAPIPathsObject("files/download", request, response), {
			"/files/download": {
				post: {
					requestBody: {
						required: true,
						content: {
							"application/octet-stream": {
								schema: {
									type: "string",
									format: "binary",
								},
							},
						},
					},
					responses: {
						"200": {
							description: "",
							content: {
								"application/pdf": {
									schema: {
										type: "string",
										format: "binary",
									},
								},
							},
						},
					},
				},
			},
		});
	});

	await t.step("convert endpoint definitions to OpenAPI document parts", () => {
		const built = app()
			.endpoint({
				path: "users/:userId",
				request: z.request({
					summary: "Get user",
					method: "GET",
					searchParams: {
						verbose: z.string().optional(),
					},
				}),
				response: z.jsonResponse({
					userId: z.id("usr_"),
				}),
				handler: () => TypedResponse.json({ userId: "usr_00000000000000000000000000" }) as never,
			})
			.endpoint({
				path: "users/:userId",
				request: z.request({
					summary: "Update user",
					method: "POST",
					body: z.object({
						name: z.string(),
					}),
				}),
				response: z.response({
					status: 204,
				}),
				handler: () => new TypedResponse(undefined, { status: 204 }),
			})
			.build();

		const documentParts: Pick<OpenAPIV3.Document, "components" | "paths"> = {
			components: {},
			paths: {
				"/users/{userId}": {
					get: {
						summary: "Get user",
						parameters: [
							{
								name: "verbose",
								in: "query",
								required: false,
								schema: { type: "string" },
							},
						],
						responses: {
							"200": {
								description: "",
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: {
												userId: {
													type: "string",
													pattern: "^usr_[0-9A-Za-z]{26}$",
													minLength: 30,
													maxLength: 30,
												},
											},
											required: ["userId"],
											additionalProperties: false,
										},
									},
								},
							},
						},
					},
					post: {
						summary: "Update user",
						requestBody: {
							required: true,
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											name: { type: "string" },
										},
										required: ["name"],
										additionalProperties: false,
									},
								},
							},
						},
						responses: {
							"204": {
								description: "",
							},
						},
					},
				},
			},
		};

		assertEquals(endpointsDefinitionToOpenAPI(built.endpoints), documentParts);

		const document: OpenAPIV3.Document = {
			openapi: "3.0.3",
			info: {
				title: "Example",
				version: "1.2.3",
			},
			servers: [{ url: "https://api.example.test" }],
			...documentParts,
		};

		assertEquals(
			createOpenAPIDocument(built, {
				info: {
					title: "Example",
					version: "1.2.3",
				},
				servers: [{ url: "https://api.example.test" }],
			}),
			document,
		);
	});
});
