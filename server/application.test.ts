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

		interface IClient {
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
		}

		function createProxy(type: string, path: string[]): any {
			return new Proxy(() => {}, {
				get(_, property, __) {
					return createProxy(type, [...path, property.toString()]);
				},
				apply: (_, __, args) => {
					const p = path.length === 0 ? args.at(0) : path;
					const a = path.length === 0 ? args.at(1) : args.at(0);
					console.log("rpc", p, a);
				},
			});
		}

		class Client {
			get rpc() {
				return createProxy("rpc", []);
			}
			get event() {
				return createProxy("event", []);
			}
			get document() {
				return createProxy("document", []);
			}
			get collection() {
				return createProxy("collection", []);
			}
		}

		// deno-fmt-ignore
		const client = new Client() as unknown as IClient & {
			rpc: {
				hello: { world: (arg1: string) => Promise<string> };
				users: Record<string, { kick: () => Promise<void> }>;
			};
			document: {
				configuration: {
					get: () => Promise<{ foo: string}>;
					set: (value: { foo: string}) => Promise<void>;
					delete: () => Promise<void>;
				}
			};
			collection: {
				users: {
					list: (options?: { limit?: number; cursor?: string }) => Promise<Array<{ userId: ID<"usr_">; username: string }>>;
					get: (id: ID<"usr_">) => Promise<{ userId: ID<"usr_">; username: string }>;
					set: (id: ID<"usr_">, data: { userId: ID<"usr_">; username: string }) => Promise<void>;
					delete: (id: ID<"usr_">) => Promise<void>;
				}
			}
		};

		await client.rpc(["hello", "world"], "123");
		await client.rpc.hello.world("123");

		const userId = "usr_123" as ID<"usr_">;
		await client.rpc(["users", userId, "kick"]);
		await client.rpc.users[userId].kick();

		await client.document.configuration.get();

		await client.collection.users.list();
		await client.collection.users.get(userId);
	});
});
