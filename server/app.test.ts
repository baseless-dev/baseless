import { ref } from "@baseless/core/ref";
import { App, app, Permission } from "./app.ts";
import * as z from "@baseless/core/schema";
import { Response } from "@baseless/core/response";
import { assertEquals } from "@std/assert/equals";

Deno.test("app", async (t) => {
	await t.step("define", () => {
		const a = app()
			.collection({
				path: `posts`,
				schema: z.object({ postId: z.id("p_"), title: z.string() }),
				collectionSecurity: () => Permission.List,
				documentSecurity: () => Permission.Get,
				topicSecurity: () => Permission.None,
			})
			.document({
				path: `users/:userid/preferences`,
				schema: z.object({
					foo: z.optional(z.boolean()),
					bar: z.optional(z.string()),
				}),
				documentSecurity: ({ auth, params }) => params.userid === auth?.identityId ? Permission.Get : Permission.None,
				topicSecurity: () => Permission.None,
			})
			.table({
				path: "users",
				schema: z.object({ id: z.string() }),
				rowSecurity: ({ q, auth }) => q.equal(q.ref("users", "id"), q.literal(auth?.identityId ?? "")),
			})
			.topic({
				path: `presence`,
				schema: z.object({ userId: z.id("u_") }),
				security: () => Permission.Subscribe,
			});

		const b = app()
			.extend(a)
			.requireConfiguration({ stripe: "" })
			.requireTable({ name: "patate", schema: z.object({ id: z.string() }) })
			.endpoint({
				path: `hello-world`,
				request: z.jsonRequest(),
				response: z.jsonResponse(),
				handler: async ({ configuration, service, request }) => {
					const _stripe = configuration.stripe;
					const _prefs = await service.document.get(ref(`users/:userid/preferences`, { userid: "123" }));
					return Response.json({});
				},
			})
			.onTopicMessage({
				path: `presence`,
				handler: async ({ message }) => {
					console.log(message);
				},
			})
			.build();

		type _a = typeof b extends App<any, infer A> ? A : never;
	});
});
