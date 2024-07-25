// deno-lint-ignore-file explicit-function-return-type require-await no-unused-vars no-explicit-any
import { assert, assertEquals, assertNotEquals, assertThrows } from "@std/assert";
import { Application } from "./application.ts";
import { Any, Static, TOptional, TString, TVoid, Type } from "@sinclair/typebox";
import { ID } from "@baseless/core/id";
import { First, Prettify, Split, UnionToTuple } from "@baseless/core/types";
import {
	PickAtPath,
	ReplaceVariableInPathSegment,
	RpcDefinitionHasSecurity,
	RpcDefinitionIsInputNonVoid,
	RpcDefinitionIsInputVoid,
	RpcDefinitionWithSecurity,
} from "./types.ts";

Deno.test("Application", async (t) => {
	await t.step("id", async () => {
		const app = new Application()
			.decorate(async ({ request }) => {
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
		type RpcNonVoid = (typeof app) extends Application<any, infer TRpc, any, any, any, any, any>
			? UnionToTuple<{
				[K in keyof TRpc]: RpcDefinitionHasSecurity<RpcDefinitionIsInputNonVoid<TRpc[K]>>
			}[number]>
			: never;
		// deno-fmt-ignore
		type RpcVoid = (typeof app) extends Application<any, infer TRpc, any, any, any, any, any>
			? UnionToTuple<{
				[K in keyof TRpc]: RpcDefinitionHasSecurity<RpcDefinitionIsInputVoid<TRpc[K]>>
			}[number]>
			: never;

		class Client {
			rpc<
				const TPath extends ReplaceVariableInPathSegment<RpcVoid[number]["path"]>,
				const RpcDefinition extends PickAtPath<RpcVoid, TPath>,
			>(
				path: TPath,
			): Promise<Static<RpcDefinition["output"]>>;
			rpc<
				const TPath extends ReplaceVariableInPathSegment<RpcNonVoid[number]["path"]>,
				const RpcDefinition extends PickAtPath<RpcNonVoid, TPath>,
			>(
				path: TPath,
				input: Static<RpcDefinition["input"]>,
			): Promise<Static<RpcDefinition["output"]>>;
			rpc(path: any, input?: any): any {
				// void
			}
		}

		const client = new Client();

		await client.rpc(["hello", "world"], "123");

		const userId = "usr_123";
		await client.rpc(["users", userId, "kick"]);

		// const r1 = await client.rpc(["hello", "world"], "foobar");
		// const r2 = await client.rpc(["authentication", "getCeremony"], undefined);
		// const r1 = await client.rpc.hello.world("foobar");
		// const r2 = await client.rpc.authentication.getCeremony(undefined);
	});
});
