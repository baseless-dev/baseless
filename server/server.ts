// // deno-lint-ignore-file no-explicit-any
// import { type Command, isCommand, isCommands } from "@baseless/core/command";
// import { type Result, ResultError, ResultSingle } from "@baseless/core/result";
// import type { Application } from "./application.ts";
// import {
// 	CollectionDefinition,
// 	Context,
// 	Decorator,
// 	DocumentDefinition,
// 	PathMatcher,
// 	RpcDefinition,
// } from "./types.ts";
// import { createPathMatcher } from "@baseless/core/path";
// import { Value } from "@sinclair/typebox/value";
// import { decodeBase64Url } from "@std/encoding/base64url";
// import { DocumentProvider, KVProvider } from "./provider.ts";
// import { DocumentService } from "./service.ts";

// export interface ServerOptions {
// 	kv: KVProvider;
// 	document: DocumentProvider;
// }

// export class Server {
// 	#application: Application;
// 	#options: ServerOptions;
// 	#decorators: Array<Decorator<any, any, any, any>>;
// 	#rpcMatcher: PathMatcher<RpcDefinition<any, any, any, any, any, any>>;
// 	#documentMatcher: PathMatcher<DocumentDefinition<any, any, any, any, any>>;
// 	#collectionMatcher: PathMatcher<CollectionDefinition<any, any, any, any, any>>;

// 	constructor(
// 		application: Application,
// 		options: ServerOptions,
// 	) {
// 		this.#application = application;
// 		this.#options = options;
// 		const { decorator, rpc, document, collection } = application.inspect();
// 		this.#decorators = decorator;
// 		this.#rpcMatcher = createPathMatcher(rpc);
// 		this.#documentMatcher = createPathMatcher(document);
// 		this.#collectionMatcher = createPathMatcher(collection);
// 	}

// 	async handleRequest(request: Request): Promise<[Response, PromiseLike<unknown>[]]> {
// 		const upgrade = request.headers.get("Upgrade")?.toLowerCase();
// 		if (upgrade === "websocket") {
// 			const protocols = request.headers.get("Sec-WebSocket-Protocol")?.split(",") ?? [];
// 			// Same method used in Kubernetes
// 			// https://github.com/kubernetes/kubernetes/commit/714f97d7baf4975ad3aa47735a868a81a984d1f0
// 			const encodedBearer = protocols.find((protocol) =>
// 				protocol.startsWith("base64url.bearer.authorization.baseless.dev.")
// 			);
// 			if (encodedBearer) {
// 				const base64Decoded = decodeBase64Url(encodedBearer.slice(44));
// 				request.headers.set(
// 					"Authorization",
// 					`Bearer ${new TextDecoder().decode(base64Decoded)}`,
// 				);
// 			} else {
// 				request.headers.delete("Authorization");
// 			}
// 			const [context, waitUntilPromises] = await this.#constructContext(request);
// 			// TODO call security handler (which one?)
// 			// TODO handle websocket upgrade with provider
// 			return [new Response(null, { status: 501 }), waitUntilPromises];
// 		}
// 		if (
// 			request.method !== "POST" ||
// 			request.headers.get("Content-Type")?.includes("application/json") !== true
// 		) {
// 			return [new Response(null, { status: 400 }), []];
// 		}

// 		const command = await request.json().catch(() => undefined);
// 		if (!isCommand(command)) {
// 			return [new Response(null, { status: 422 }), []];
// 		}

// 		try {
// 			const [result, promises] = await this.#handleCommand(command, request);
// 			return [Response.json(result), promises];
// 		} catch (error) {
// 			return [
// 				Response.json({ kind: "error", error: error?.name ?? error }, { status: 500 }),
// 				[],
// 			];
// 		}
// 	}

// 	handleCommand(command: Command): Promise<[Result, PromiseLike<unknown>[]]> {
// 		return this.#handleCommand(command, new Request("https://local/"));
// 	}

// 	async #constructContext(
// 		request: Request,
// 	): Promise<[Context<Record<string, unknown>, [], []>, PromiseLike<unknown>[]]> {
// 		const waitUntilPromises: PromiseLike<unknown>[] = [];
// 		const context: Context<Record<string, unknown>, [], []> = {
// 			...this.#options,
// 			request,
// 			kv: this.#options.kv,
// 			document: new DocumentService(
// 				this.#options.document,
// 				this.#documentMatcher,
// 				this.#collectionMatcher,
// 			),
// 			waitUntil: (promise) => {
// 				waitUntilPromises.push(promise);
// 			},
// 		};
// 		for (const decorator of this.#decorators) {
// 			Object.assign(context, await decorator(context));
// 		}
// 		return [context, waitUntilPromises];
// 	}

// 	async #handleCommand(
// 		command: Command,
// 		request: Request,
// 	): Promise<[Result, PromiseLike<unknown>[]]> {
// 		const [context, waitUntilPromises] = await this.#constructContext(request);

// 		const bulk = isCommands(command);
// 		const commands = bulk ? command.commands : [command];
// 		const results: Array<ResultSingle | ResultError> = [];

// 		for (const command of commands) {
// 			const rpcDefinition = this.#rpcMatcher(command.rpc);
// 			if (!rpcDefinition) {
// 				results.push({ kind: "error", error: "not_found" });
// 				continue;
// 			}
// 			if ("security" in rpcDefinition) {
// 				const security = await rpcDefinition.security({ context, params: {} });
// 				if (security !== "allow") {
// 					results.push({ kind: "error", error: "forbidden" });
// 					continue;
// 				}
// 			}
// 			if (!Value.Check(rpcDefinition.input, command.input)) {
// 				results.push({ kind: "error", error: "invalid_input" });
// 				continue;
// 			}
// 			const result = await rpcDefinition.handler({
// 				context,
// 				params: {},
// 				input: command.input,
// 			});
// 			results.push({ kind: "result", value: result });
// 		}

// 		const result: Result = bulk ? { kind: "results", results } : results.at(0)!;

// 		return [result, waitUntilPromises];
// 	}
// }
