// deno-lint-ignore-file require-await no-explicit-any
import { assert, assertEquals, assertObjectMatch, assertRejects } from "@std/assert";
import { ApplicationBuilder } from "./builder.ts";
import { Type } from "@sinclair/typebox";
import { MemoryDocumentProvider } from "@baseless/inmemory-provider";

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
				security: async () => {
					return "allow" as const;
				},
			})
			.build();

		assertRejects(() => app.invokeRpc({ context, rpc: ["users"], input: 0 }));
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
	await t.step("app.getDocumentAtomic().set", async () => {
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
				security: async () => "set",
			})
			.build();

		await app.commitDocumentAtomic({
			context,
			provider: documentProvider,
			checks: [],
			ops: [
				{ type: "set", key: ["users", "1"], data: "foo" },
				{ type: "set", key: ["users", "2"], data: "bar" },
			],
		});
	});
	await t.step("app.getDocumentAtomic().delete", async () => {
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
				security: async () => "delete",
			})
			.build();

		await app.commitDocumentAtomic({
			context,
			provider: documentProvider,
			checks: [],
			ops: [
				{ type: "delete", key: ["users", "2"] },
			],
		});
	});
	await t.step("app.getDocument", async () => {
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
				security: async () => "get",
			})
			.build();

		await assertRejects(() =>
			app.getDocument({ context, provider: documentProvider, path: ["users", "2"] })
		);
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
				security: async () => "set",
			})
			.onDocumentSaving(["users", "{userId}"], async ({ params }) => {
				event.push(params.userId);
				if (params.userId === "error") {
					throw new Error("nope");
				}
			})
			.build();

		await app.getDocumentAtomic({ context, provider: documentProvider })
			.set(["users", "3"], "bar")
			.commit();

		assert(event.includes("3"));

		await assertRejects(() =>
			app.getDocumentAtomic({ context, provider: documentProvider })
				.set(["users", "error"], "error")
				.commit()
		);
	});
	await t.step("app.onDocumentSaved", async () => {
		const event: string[] = [];
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
				security: async () => "set",
			})
			.onDocumentSaved(["users", "{userId}"], async ({ params }) => {
				event.push(params.userId);
				if (params.userId === "error") {
					throw new Error("nope");
				}
			})
			.build();

		await app.getDocumentAtomic({ context, provider: documentProvider })
			.set(["users", "4"], "joo")
			.commit();

		assert(event.includes("4"));

		await app.getDocumentAtomic({ context, provider: documentProvider })
			.set(["users", "error"], "error")
			.commit();
	});
});
