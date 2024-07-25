// deno-lint-ignore-file require-await explicit-function-return-type
import { assert, assertEquals, assertNotEquals, assertThrows } from "@std/assert";
import { Application } from "./application.ts";
import { Type } from "@sinclair/typebox";
import { ID } from "@baseless/core/id";

Deno.test("Application", async (t) => {
	await t.step("id", async () => {
		const app = new Application()
			.decorate(async () => {
				return { foo: "bar" };
			})
			.rpc(["hello", "internal"], {
				input: Type.String(),
				output: Type.String(),
				handler: async ({ input }) => {
					return input;
				},
			})
			.rpc(["hello", "world"], {
				input: Type.String(),
				output: Type.String(),
				handler: async ({ input }) => {
					return input;
				},
				async security() {
					return "allow" as const;
				},
			})
			.rpc(["users", "{userId}", "kick"], {
				input: Type.Void(),
				output: Type.String(),
				handler: async ({ params: { userId } }) => {
					return userId;
				},
				security: async ({ params: { userId } }) => {
					console.log({ userId });
					return "allow" as const;
				},
			})
			.emits(["some", "event"], {
				payload: Type.Literal("a"),
			})
			.emits(["some", "other", "event"], {
				payload: Type.Literal("b"),
			})
			.document(["configuration"], {
				schema: Type.Object({
					foo: Type.String(),
				}),
				async security() {
					return "read" as const;
				},
			})
			.collection(["users"], {
				schema: Type.Object({
					userId: ID("usr_"),
					username: Type.String(),
				}),
			})
			.onEvent(["some", "other", "event"], async ({ payload }) => {
				console.log({ payload });
			})
			.onDocumentSaved(["configuration"], async ({ document }) => {
				console.log({ document });
			})
			.onDocumentSaving(
				["configuration"],
				async ({ atomic, document }) => {
					console.log({ atomic, document });
				},
			);
	});
});
