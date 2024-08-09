import { Application } from "./application.ts";
import { DocumentProvider, KVProvider } from "./provider.ts";
import { decodeBase64Url } from "@std/encoding/base64url";
import { type Command, isCommand, isCommands } from "@baseless/core/command";
import { Result, ResultError, ResultSingle } from "@baseless/core/result";
import { Context } from "./types.ts";
import { DocumentProviderFacade } from "./facade.ts";

export class Server {
	#application: Application;
	#kvProvider: KVProvider;
	#documentProvider: DocumentProvider;

	constructor(options: { application: Application; kv: KVProvider; document: DocumentProvider }) {
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
			const encodedBearer = protocols.find((protocol) =>
				protocol.startsWith("base64url.bearer.authorization.baseless.dev.")
			);
			if (encodedBearer) {
				const base64Decoded = decodeBase64Url(encodedBearer.slice(44));
				request.headers.set(
					"Authorization",
					`Bearer ${new TextDecoder().decode(base64Decoded)}`,
				);
			} else {
				request.headers.delete("Authorization");
			}
			const [context, waitUntilPromises] = await this.#constructContext(request);
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
		if (!isCommand(command)) {
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
		context.document = new DocumentProviderFacade(
			this.#application,
			context,
			this.#documentProvider,
		) as never;
		await this.#application.decorate(context);
		return [context, waitUntilPromises];
	}

	async #handleCommand(
		command: Command,
		request: Request,
	): Promise<[Result, PromiseLike<unknown>[]]> {
		try {
			const [context, waitUntilPromises] = await this.#constructContext(request);

			const bulk = isCommands(command);
			const commands = bulk ? command.commands : [command];
			const results: Array<ResultSingle | ResultError> = [];

			for (const command of commands) {
				try {
					const result = await this.#application.invokeRpc({
						context,
						key: command.rpc,
						input: command.input,
					});
					results.push({ kind: "result", value: result });
				} catch (error) {
					results.push({
						kind: "error",
						error: error.constructor?.name ?? error?.name ?? error,
					});
				}
			}

			const result: Result = bulk ? { kind: "results", results } : results.at(0)!;

			return [result, waitUntilPromises];
		} catch (error) {
			return [{ kind: "error", error: error.constructor?.name ?? error?.name ?? error }, []];
		}
	}
}
