// deno-lint-ignore-file require-await no-explicit-any
import { assert, assertEquals, assertObjectMatch, assertRejects } from "@std/assert";
import { ApplicationBuilder } from "./application_builder.ts";
import { Type } from "@sinclair/typebox";
import { MemoryDocumentProvider } from "@baseless/inmemory-provider";
import { Permission } from "./types.ts";
import { InvalidSchemaError } from "./application.ts";

Deno.test("Application", async (t) => {
	const context: any = {};
	await t.step("app.handleRpcCommand", async () => {
		const app = new ApplicationBuilder()
			.rpc(["users", "{userId}", "kick"], {
				input: Type.Void(),
				output: Type.String(),
				handler: async ({ params: { userId } }) => {
					return userId;
				},
				security: async () => Permission.All,
			})
			.build();

		await assertRejects(() => app.invokeRpc({ context, rpc: ["users"], input: 0 }));
		await assertRejects(() => app.invokeRpc({ context, rpc: ["users", "123", "kick"], input: "invalid" }), InvalidSchemaError);
		assertEquals(
			await app.invokeRpc({
				context,
				rpc: ["users", "123", "kick"],
				input: undefined,
			}),
			"123",
		);
	});
	const documentProvider = new MemoryDocumentProvider();
	const eventProvider = {} as never;
	await t.step("app.getDocumentAtomic().set", async () => {
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
				security: async () => Permission.All,
			})
			.build();

		await app.commitDocumentAtomic({
			context,
			documentProvider,
			eventProvider,
			checks: [],
			operations: [
				{ type: "set", key: ["users", "1"], data: "foo" },
				{ type: "set", key: ["users", "2"], data: "bar" },
			],
		});

		await assertRejects(() =>
			app.commitDocumentAtomic({
				context,
				documentProvider,
				eventProvider,
				checks: [],
				operations: [{ type: "set", key: ["users", "invalid"], data: 42 }],
			}), InvalidSchemaError);
	});
	await t.step("app.getDocumentAtomic().delete", async () => {
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
				security: async () => Permission.All,
			})
			.build();

		await app.commitDocumentAtomic({
			context,
			documentProvider,
			eventProvider,
			checks: [],
			operations: [
				{ type: "delete", key: ["users", "2"] },
			],
		});
	});
	await t.step("app.getDocument", async () => {
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
				security: async () => Permission.All,
			})
			.build();

		await assertRejects(() => app.getDocument({ context, provider: documentProvider, path: ["users", "2"] }));
		assertObjectMatch(
			await app.getDocument({ context, provider: documentProvider, path: ["users", "1"] }),
			{ data: "foo" },
		);
	});
	await t.step("app.onDocumentSaving", async () => {
		const event: string[] = [];
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
				security: async ({ params }) => params.userId === "deny" ? Permission.None : Permission.All,
			})
			.onDocumentSaving(["users", "{userId}"], async ({ params }) => {
				event.push(params.userId);
				if (params.userId === "error") {
					throw new Error("nope");
				}
			})
			.build();

		await app.commitDocumentAtomic({
			context,
			documentProvider,
			eventProvider,
			checks: [],
			operations: [
				{ type: "set", key: ["users", "3"], data: "foo" },
			],
		});

		assert(event.includes("3"));

		await assertRejects(() =>
			app.commitDocumentAtomic({
				context,
				documentProvider,
				eventProvider,
				checks: [],
				operations: [
					{ type: "set", key: ["users", "deny"], data: "deny" },
				],
			})
		);

		await assertRejects(() =>
			app.commitDocumentAtomic({
				context,
				documentProvider,
				eventProvider,
				checks: [],
				operations: [
					{ type: "set", key: ["users", "error"], data: "error" },
				],
			})
		);
	});
	await t.step("app.onDocumentSaved", async () => {
		const event: string[] = [];
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
				security: async () => Permission.All,
			})
			.onDocumentSaved(["users", "{userId}"], async ({ params }) => {
				event.push(params.userId);
				if (params.userId === "error") {
					throw new Error("nope");
				}
			})
			.build();

		await app.commitDocumentAtomic({
			context,
			documentProvider,
			eventProvider,
			checks: [],
			operations: [
				{ type: "set", key: ["users", "4"], data: "joo" },
			],
		});

		assert(event.includes("4"));

		app.commitDocumentAtomic({
			context,
			documentProvider,
			eventProvider,
			checks: [],
			operations: [
				{ type: "set", key: ["users", "error"], data: "error" },
			],
		});
	});
});
