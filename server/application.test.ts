// deno-lint-ignore-file require-await explicit-function-return-type
import { assert, assertEquals, assertNotEquals, assertRejects, assertThrows } from "@std/assert";
import { ApplicationBuilder } from "./applicationbuilder.ts";
import { Type } from "@sinclair/typebox";
import { ID } from "@baseless/core/id";

Deno.test("Application", async (t) => {
	// await t.step("decorate", async () => {
	// 	const app = new ApplicationBuilder()
	// 		.decorate(async () => {
	// 			return { foo: "bar" };
	// 		})
	// 		.build();
	// 	assert("foo" in await app.getDecoration());
	// });
	await t.step("rpc", async () => {
		const app = new ApplicationBuilder()
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
			.build();

		assertRejects(() =>
			app.invokeRpc({ context: {} as any, key: ["users"], input: 0, bypassSecurity: true })
		);
		assertEquals(
			await app.invokeRpc({
				context: {} as any,
				key: ["users", "123", "kick"],
				input: undefined,
				bypassSecurity: true,
			}),
			"123",
		);
	});
	// await t.step("emits", async () => {
	// 	const app = new ApplicationBuilder()
	// 		.emits(["foo", "bar"], {
	// 			payload: Type.Literal("a"),
	// 		})
	// 		.onEvent(["foo", "bar"], async ({ payload }) => {
	// 			console.log({ payload });
	// 		});
	// 	const { event, eventListeners } = app.inspect();
	// 	assert(event.length === 1);
	// 	assertEquals(event[0].path, ["foo", "bar"]);
	// 	assert(eventListeners.length === 1);
	// 	assertEquals(eventListeners[0].path, ["foo", "bar"]);
	// });
	// await t.step("document", async () => {
	// 	const app = new ApplicationBuilder()
	// 		.document(["configuration"], {
	// 			schema: Type.Object({
	// 				foo: Type.String(),
	// 			}),
	// 			async security() {
	// 				return "read" as const;
	// 			},
	// 		})
	// 		.onDocumentSaving(["configuration"], async ({ document }) => {
	// 			console.log({ document });
	// 		})
	// 		.onDocumentSaved(["configuration"], async ({ document }) => {
	// 			console.log({ document });
	// 		})
	// 		.onDocumentDeleting(["configuration"], async ({ document }) => {
	// 			console.log({ document });
	// 		})
	// 		.onDocumentDeleted(["configuration"], async ({ document }) => {
	// 			console.log({ document });
	// 		});
	// 	const {
	// 		document,
	// 		documentSavingListeners,
	// 		documentSavedListeners,
	// 		documentDeletingListeners,
	// 		documentDeletedListeners,
	// 	} = app.inspect();
	// 	assert(document.length === 1);
	// 	assertEquals(document[0].path, ["configuration"]);
	// 	assert(documentSavingListeners.length === 1);
	// 	assertEquals(documentSavingListeners[0].path, ["configuration"]);
	// 	assert(documentSavedListeners.length === 1);
	// 	assertEquals(documentSavedListeners[0].path, ["configuration"]);
	// 	assert(documentDeletingListeners.length === 1);
	// 	assertEquals(documentDeletingListeners[0].path, ["configuration"]);
	// 	assert(documentDeletedListeners.length === 1);
	// 	assertEquals(documentDeletedListeners[0].path, ["configuration"]);
	// });
	// await t.step("collection", async () => {
	// 	const app = new ApplicationBuilder()
	// 		.collection(["users"], {
	// 			schema: Type.Object({
	// 				userId: ID("usr_"),
	// 				username: Type.String(),
	// 			}),
	// 		});
	// 	const { collection } = app.inspect();
	// 	assert(collection.length === 1);
	// 	assertEquals(collection[0].path, ["users"]);
	// });
});
