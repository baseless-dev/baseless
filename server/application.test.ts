// deno-lint-ignore-file explicit-function-return-type require-await no-unused-vars
import {
	assert,
	assertEquals,
	assertNotEquals,
	assertThrows,
} from "@std/assert";
import {
	Application,
	PickAtPath,
	RpcDefinitionWithSecurity,
} from "./application.ts";
import { Static, Type } from "@sinclair/typebox";
import { ID } from "../core/id.ts";
import { Prettify } from "../core/types.ts";

Deno.test("Application", async (t) => {
	await t.step("id", async () => {
		const app = new Application()
			.context(async ({ request, context }) => {
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
				security() {
					return "allow" as const;
				},
			})
			.rpc(["authentication", "getCeremony"], {
				input: Type.Unknown(),
				output: Type.Unknown(),
				handler: async ({ input }) => {
					return input;
				},
				security() {
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
				security() {
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
			.onDocumentSet(["configuration"], async ({ document }) => {
				console.log({ document });
			})
			.onDocumentAtomicSet(
				["configuration"],
				async ({ atomic, document }) => {
					console.log({ atomic, document });
				},
			);

		// deno-fmt-ignore
		type TClientRpc = (typeof app) extends Application<any, infer TRpc, any, any, any, any, any>
			? { [K in keyof TRpc]: TRpc[K] extends RpcDefinitionWithSecurity<infer P, any, infer I, infer O> ? RpcDefinitionWithSecurity<P, {}, I, O> : never }
			: never;

		type B = Prettify<TClientRpc>;

		// function clientRpc1<
		// 	const TPath extends TClientRpc[number]["path"],
		// 	RpcDefinition extends PickAtPath<TClientRpc, TPath>,
		// >(
		// 	path: TPath,
		// 	input: Static<RpcDefinition["input"]>,
		// ): Promise<Static<RpcDefinition["output"]>> {
		// 	throw "TODO";
		// }

		// // deno-fmt-ignore
		// type ArrayToObject<T extends unknown[], I, O> = T extends [infer Item, ...infer Rest]
		// 	? Item extends string
		// 		? { [K in Item]: ArrayToObject<Rest, I, O> }
		// 		: never
		// 		: (input: I) => Promise<O>;

		// interface ClientRpc extends
		// 	ArrayToObject<
		// 		TClientRpc[number]["path"],
		// 		Static<TClientRpc[number]["input"]>,
		// 		Static<TClientRpc[number]["output"]>
		// 	> {}

		// // TODO create proxy from Application
		// const clientRpc2: ClientRpc = {} as never;

		// const result1 = await clientRpc1(["hello", "world"], "foobar");
		// const result2 = await clientRpc1(
		// 	["authentication", "getCeremony"],
		// 	"foobar",
		// );
		// // const result3 = await clientRpc2.hello.world("foobar");

		// client.rpc(["hello", "world"], "foobar");
		// client.rpc.hello.world("foobar");
		// client.document(["settings"]).get();
		// client.document.settings.get();
		// client.collection(["posts", "po_123", "comments"]).list();
		// client.collection(["posts", "po_123", "comments"]).get("com_123");
		// client.collection.posts["po_123"].comments.list();
		// client.collection.posts["po_123"].comments.get("com_123");
	});
});
