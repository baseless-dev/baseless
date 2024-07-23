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
	RpcDefinitionWithoutSecurity,
	RpcDefinitionWithSecurity,
} from "./application.ts";
import { Any, Static, TVoid, Type } from "@sinclair/typebox";
import { ID } from "../core/id.ts";
import { First, Prettify, Split, UnionToTuple } from "../core/types.ts";

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
				input: Type.Void(),
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
		type RpcUnionNonVoid = (typeof app) extends Application<any, infer TRpc, any, any, any, any, any>
			? {
				[K in keyof TRpc]: TRpc[K] extends RpcDefinitionWithSecurity<infer P, any, infer I, infer O>
					? I extends TVoid
						? never
						: RpcDefinitionWithSecurity<P, never, I, O>
					: never
			}[number]
			: never;
		type RpcTupleNonVoid = UnionToTuple<RpcUnionNonVoid>;
		// deno-fmt-ignore
		type RpcUnionVoid = (typeof app) extends Application<any, infer TRpc, any, any, any, any, any>
			? {
				[K in keyof TRpc]: TRpc[K] extends RpcDefinitionWithSecurity<infer P, any, infer I, infer O>
					? I extends TVoid
						? RpcDefinitionWithSecurity<P, never, I, O>
						: never
					: never
			}[number]
			: never;
		type RpcTupleVoid = UnionToTuple<RpcUnionVoid>;

		function clientRpc<
			const TPath extends RpcTupleVoid[number]["path"],
			const RpcDefinition extends PickAtPath<RpcTupleVoid, TPath>,
		>(
			path: TPath,
		): Promise<Static<RpcDefinition["output"]>>;
		function clientRpc<
			const TPath extends RpcTupleNonVoid[number]["path"],
			const RpcDefinition extends PickAtPath<RpcTupleNonVoid, TPath>,
		>(
			path: TPath,
			input: Static<RpcDefinition["input"]>,
		): Promise<Static<RpcDefinition["output"]>>;
		function clientRpc(path: any, input?: any): any {
			throw "TODO";
		}

		const client = {
			rpc: {} as any,
		};

		clientRpc(["hello", "world"], "foobar");
		clientRpc(["authentication", "getCeremony"]);
		client.rpc.hello.world("foobar");
		client.rpc.authentication.getCeremony();
	});
});
