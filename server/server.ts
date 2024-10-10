import { Application } from "./application.ts";
import { DocumentProvider } from "./document_provider.ts";
import { KVProvider } from "./kv_provider.ts";
import { decodeBase64Url } from "@std/encoding/base64url";
import { type Command, Commands, isCommand, isCommands } from "@baseless/core/command";
import { Result, ResultError, ResultSingle } from "@baseless/core/result";
import { ApplicationDocumentProviderFacade } from "./application_document_facade.ts";
import { Context } from "./types.ts";
import { HubProvider } from "./hub_provider.ts";
import { ApplicationEventProviderFacade } from "./application_event_facade.ts";
import { EventProvider } from "./event_provider.ts";
import { ApplicationHubServiceFacade } from "./application_hub_facade.ts";

export class Server {
	#application: Application;
	#documentProvider: DocumentProvider;
	#eventProvider: EventProvider;
	#hubProvider?: HubProvider;
	#kvProvider: KVProvider;

	constructor(
		options: {
			application: Application;
			document: DocumentProvider;
			event: EventProvider;
			hub?: HubProvider;
			kv: KVProvider;
		},
	) {
		this.#application = options.application;
		this.#documentProvider = options.document;
		this.#eventProvider = options.event;
		this.#hubProvider = options.hub;
		this.#kvProvider = options.kv;
	}

	async handleRequest(request: Request): Promise<[Response, PromiseLike<unknown>[]]> {
		const upgrade = request.headers.get("Upgrade")?.toLowerCase();
		if (this.#hubProvider && upgrade === "websocket") {
			// Request in a websocket upgrade might be special like in Deno, do not alter it
			let requestForContext: Request;
			const protocols = request.headers.get("Sec-WebSocket-Protocol")?.split(",") ?? [];
			// Same method used in Kubernetes
			// https://github.com/kubernetes/kubernetes/commit/714f97d7baf4975ad3aa47735a868a81a984d1f0
			const encodedBearer = protocols.find((protocol) => protocol.startsWith("base64url.bearer.authorization.baseless.dev."));
			if (encodedBearer) {
				const base64Decoded = decodeBase64Url(encodedBearer.slice(44));
				requestForContext = new Request(request.url, {
					headers: {
						...request.headers,
						"Authorization": `Bearer ${new TextDecoder().decode(base64Decoded)}`,
					},
				});
			} else if (request.headers.has("Authorization")) {
				const headers = new Headers(request.headers);
				headers.delete("Authorization");
				requestForContext = new Request(request.url, { headers });
			} else {
				requestForContext = request;
			}
			try {
				const [context, waitUntilPromises] = await this.makeContext(requestForContext);
				// TODO security?
				const response = await this.#hubProvider.transfer(request, context);
				return [response, waitUntilPromises];
			} catch (error) {
				return [
					Response.json({ kind: "error", error: error instanceof Error ? error.constructor.name : error }, { status: 500 }),
					[],
				];
			}
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
				Response.json({ kind: "error", error: error instanceof Error ? error.constructor.name : error }, { status: 500 }),
				[],
			];
		}
	}

	handleCommand(command: Command): Promise<[Result, PromiseLike<unknown>[]]> {
		return this.#handleCommand(command, new Request("https://local/"));
	}

	async makeContext(
		request: Request,
	): Promise<[Context, PromiseLike<unknown>[]]> {
		const waitUntilPromises: PromiseLike<unknown>[] = [];
		const context: Context = {
			request,
			document: {} as never, // lazy initilization
			event: {} as never, // lazy initilization
			hub: {} as never, // lazy initilization
			kv: this.#kvProvider,
			waitUntil: (promise: PromiseLike<unknown>) => {
				waitUntilPromises.push(promise);
			},
		};
		context.document = new ApplicationDocumentProviderFacade(
			this.#application,
			context,
			this.#documentProvider,
			this.#eventProvider,
		) as never;
		context.event = new ApplicationEventProviderFacade(this.#application, context, this.#eventProvider) as never;
		context.hub = new ApplicationHubServiceFacade(this.#application, context, this.#hubProvider!) as never;
		await this.#application.decorate(context);
		return [context, waitUntilPromises];
	}

	async #handleCommand(
		command: Command | Commands,
		request: Request,
	): Promise<[Result, PromiseLike<unknown>[]]> {
		try {
			const [context, waitUntilPromises] = await this.makeContext(request);

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
						result = await Array.fromAsync(this.#application.listDocument({
							context,
							cursor: command.cursor,
							limit: command.limit,
							prefix: command.prefix,
							provider: this.#documentProvider,
						}));
					} else if (command.kind === "document-atomic") {
						result = await this.#application.commitDocumentAtomic({
							checks: command.checks,
							context,
							operations: command.ops,
							documentProvider: this.#documentProvider,
							eventProvider: this.#eventProvider,
						});
					} else if (command.kind === "event-publish") {
						result = await this.#application.publishEvent({
							context,
							event: command.event,
							payload: command.payload,
							provider: this.#eventProvider,
						});
					} else {
						throw "UnknownCommand";
					}
					results.push({ kind: "result", value: result });
				} catch (error) {
					const result = error instanceof Error ? error.constructor.name : error;
					results.push({ kind: "error", error: result });
				}
			}

			const result: Result = bulk ? { kind: "results", results } : results.at(0)!;

			return [result, waitUntilPromises];
		} catch (error) {
			return [{ kind: "error", error: error instanceof Error ? error.constructor.name : error }, []];
		}
	}
}
