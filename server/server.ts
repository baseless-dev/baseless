import { Application } from "./application.ts";
import { DocumentProvider } from "./document_provider.ts";
import { KVProvider } from "./kv_provider.ts";
import { decodeBase64Url } from "@std/encoding/base64url";
import { type Command, Commands, isCommand, isCommands } from "@baseless/core/command";
import { Result, ResultError, ResultSingle } from "@baseless/core/result";
import { ApplicationDocumentProviderFacade } from "./application_document_facade.ts";
import { Context } from "./types.ts";

export class Server {
	#application: Application;
	#kvProvider: KVProvider;
	#documentProvider: DocumentProvider;

	constructor(
		options: {
			application: Application;
			kv: KVProvider;
			document: DocumentProvider;
		},
	) {
		this.#application = options.application;
		this.#kvProvider = options.kv;
		this.#documentProvider = options.document;
	}

	async handleRequest(request: Request): Promise<[Response, PromiseLike<unknown>[]]> {
		const upgrade = request.headers.get("Upgrade")?.toLowerCase();
		if (upgrade === "websocket") {
			const protocols = request.headers.get("Sec-WebSocket-Protocol")?.split(",") ?? [];
			// Same method used in Kubernetes
			// https://github.com/kubernetes/kubernetes/commit/714f97d7baf4975ad3aa47735a868a81a984d1f0
			const encodedBearer = protocols.find((protocol) => protocol.startsWith("base64url.bearer.authorization.baseless.dev."));
			if (encodedBearer) {
				const base64Decoded = decodeBase64Url(encodedBearer.slice(44));
				request.headers.set(
					"Authorization",
					`Bearer ${new TextDecoder().decode(base64Decoded)}`,
				);
			} else {
				request.headers.delete("Authorization");
			}
			const [_context, waitUntilPromises] = await this.#constructContext(request);
			// TODO call security handler (which one?)
			// TODO handle websocket upgrade with provider
			return [new Response(null, { status: 501 }), waitUntilPromises];
		}
		if (
			request.method !== "POST" ||
			request.headers.get("Content-Type")?.includes("application/json") !== true
		) {
			return [new Response(null, { status: 400 }), []];
		}

		const command = await request.json().catch(() => undefined);
		if (!(isCommand(command) || isCommands(command))) {
			return [new Response(null, { status: 422 }), []];
		}

		try {
			const [result, promises] = await this.#handleCommand(command, request);
			return [Response.json(result), promises];
		} catch (error) {
			return [
				Response.json({ kind: "error", error: error?.name ?? error }, { status: 500 }),
				[],
			];
		}
	}

	handleCommand(command: Command): Promise<[Result, PromiseLike<unknown>[]]> {
		return this.#handleCommand(command, new Request("https://local/"));
	}

	async #constructContext(
		request: Request,
	): Promise<[Context<Record<string, unknown>, [], []>, PromiseLike<unknown>[]]> {
		const waitUntilPromises: PromiseLike<unknown>[] = [];
		const context: Context<Record<string, unknown>, [], []> = {
			request,
			kv: this.#kvProvider,
			document: {} as never, // lazy initilization of IDocumentProvider
			waitUntil: (promise: PromiseLike<unknown>) => {
				waitUntilPromises.push(promise);
			},
		};
		context.document = new ApplicationDocumentProviderFacade(
			this.#application,
			context,
			this.#documentProvider,
		) as never;
		await this.#application.decorate(context);
		return [context, waitUntilPromises];
	}

	async #handleCommand(
		command: Command | Commands,
		request: Request,
	): Promise<[Result, PromiseLike<unknown>[]]> {
		try {
			const [context, waitUntilPromises] = await this.#constructContext(request);

			const bulk = isCommands(command);
			const commands = bulk ? command.commands : [command];
			const results: Array<ResultSingle | ResultError> = [];

			for (const command of commands) {
				try {
					let result: unknown;
					if (command.kind === "rpc") {
						result = await this.#application.invokeRpc({
							context,
							input: command.input,
							rpc: command.rpc,
						});
					} else if (command.kind === "document-get") {
						result = await this.#application.getDocument({
							context,
							path: command.path,
							provider: this.#documentProvider,
						});
					} else if (command.kind === "document-get-many") {
						result = await this.#application.getManyDocument({
							context,
							paths: command.paths,
							provider: this.#documentProvider,
						});
					} else if (command.kind === "document-list") {
						result = await this.#application.listDocument({
							context,
							cursor: command.cursor,
							limit: command.limit,
							prefix: command.prefix,
							provider: this.#documentProvider,
						});
					} else if (command.kind === "document-atomic") {
						result = await this.#application.commitDocumentAtomic({
							checks: command.checks,
							context,
							operations: command.ops,
							provider: this.#documentProvider,
						});
					} else {
						throw "UnknownCommand";
					}
					results.push({ kind: "result", value: result });
				} catch (error) {
					const result = error.constructor?.name ?? error?.name ?? error;
					results.push({ kind: "error", error: result });
				}
			}

			const result: Result = bulk ? { kind: "results", results } : results.at(0)!;

			return [result, waitUntilPromises];
		} catch (error) {
			return [{ kind: "error", error: error.constructor?.name ?? error?.name ?? error }, []];
		}
	}
}
