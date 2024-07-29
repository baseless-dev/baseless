import { type Command, isCommand, isCommands } from "@baseless/core/command";
import { type Result } from "@baseless/core/result";
import type { Application } from "./application.ts";
import { Context, Decorator, RpcDefinition } from "./types.ts";
import { ResultSingle } from "../core/result.ts";

export class Server {
	#application: Application;
	// deno-lint-ignore no-explicit-any
	#decorators: Array<Decorator<any, any>>;
	// deno-lint-ignore no-explicit-any
	#rpcs: Array<RpcDefinition<any, any, any, any>>;

	constructor(application: Application) {
		this.#application = application;
		const { decorator, rpc } = application.inspect();
		this.#decorators = decorator;
		this.#rpcs = rpc;
		// TODO when possible, compile a specialized function that handle paths matching
	}

	async handleRequest(request: Request): Promise<[Response, PromiseLike<unknown>[]]> {
		const upgrade = request.headers.get("Upgrade")?.toLowerCase();
		if (upgrade === "websocket") {
			const protocols = request.headers.get("Sec-WebSocket-Protocol")?.split(",") ?? [];
			if (!protocols.includes("baseless-ws")) {
				return [new Response(null, { status: 421 }), []];
			}
			// TODO decorate context
			// TODO call security handler (wich one?)
			// TODO handle websocket upgrade
			return [new Response(null, { status: 501 }), []];
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

	async #handleCommand(
		command: Command,
		request: Request,
	): Promise<[Result, PromiseLike<unknown>[]]> {
		const waitForPromises: PromiseLike<unknown>[] = [];
		const context: Context<unknown> = { request };
		for (const decorator of this.#decorators) {
			Object.assign(context, await decorator(context));
		}

		const bulk = isCommands(command);
		const commands = bulk ? command.commands : [command];
		const results: ResultSingle[] = [];

		for (const command in commands) {
			// TODO find `rpc` using regex?
			// TODO Value.Check command.input against rpc.input
			// TODO call rpc.handler with context & command.input
			throw "not_implemented";
		}

		const result: Result = bulk
			? { kind: "results", results }
			: { kind: "result", value: results.at(0) };

		return [result, waitForPromises];
	}
}
