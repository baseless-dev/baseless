// deno-lint-ignore-file require-await explicit-function-return-type
import { assert, assertEquals, assertObjectMatch, assertRejects } from "@std/assert";
import { ApplicationBuilder } from "./applicationbuilder.ts";
import { Type } from "@sinclair/typebox";
import { MemoryDocumentProvider } from "@baseless/inmemory-provider";

Deno.test("Application", async (t) => {
	const context: any = {};
	await t.step("app.invokeRpc", async () => {
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

		assertRejects(() => app.invokeRpc({ context, key: ["users"], input: 0 }));
		assertEquals(
			await app.invokeRpc({
				context,
				key: ["users", "123", "kick"],
				input: undefined,
			}),
			"123",
		);
	});
	const documentProvider = new MemoryDocumentProvider();
	await t.step("app.atomicDocument().set", async () => {
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
			})
			.build();

		assertEquals(
			await app.atomicDocument({ context, provider: documentProvider })
				.set(["users", "1"], "foo")
				.commit(),
			{ ok: true },
		);
	});
	await t.step("app.getDocument", async () => {
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
			})
			.build();

		await assertRejects(() =>
			app.getDocument({ context, provider: documentProvider, key: ["users", "0"] })
		);
		assertObjectMatch(
			await app.getDocument({ context, provider: documentProvider, key: ["users", "1"] }),
			{ data: "foo" },
		);
	});
	await t.step("app.onDocumentSaving", async () => {
		const event: string[] = [];
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
			})
			.onDocumentSaving(["users", "{userId}"], async ({ params }) => {
				event.push(params.userId);
				if (params.userId === "error") {
					throw new Error("nope");
				}
			})
			.build();

		await app.atomicDocument({ context, provider: documentProvider })
			.set(["users", "2"], "bar")
			.commit();

		assert(event.includes("2"));

		await assertRejects(() =>
			app.atomicDocument({ context, provider: documentProvider })
				.set(["users", "error"], "error")
				.commit()
		);
	});
	await t.step("app.onDocumentSaved", async () => {
		const event: string[] = [];
		const app = new ApplicationBuilder()
			.document(["users", "{userId}"], {
				schema: Type.String(),
			})
			.onDocumentSaved(["users", "{userId}"], async ({ params }) => {
				event.push(params.userId);
				if (params.userId === "error") {
					throw new Error("nope");
				}
			})
			.build();

		await app.atomicDocument({ context, provider: documentProvider })
			.set(["users", "3"], "bar")
			.commit();

		assert(event.includes("3"));

		await app.atomicDocument({ context, provider: documentProvider })
			.set(["users", "error"], "error")
			.commit();
	});
});
