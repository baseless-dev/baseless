import type {
	ApplicationBuilder,
	CollectionDefinition,
	DocumentDefinition,
	EventDefinition,
	PickAtPath,
	RpcDefinition,
	WithSecurity,
} from "@baseless/server/application";
import type { Static } from "@sinclair/typebox";
import { isResultError, isResults, isResultSingle, ResultSingle } from "@baseless/core/result";
import MemoryStorage from "./memory_storage.ts";
import { CommandSingle } from "../core/command.ts";
import { isProfile, Profile } from "./types.ts";
import { stableStringify } from "./stablestringify.ts";

export interface ClientInitialization {
	clientId: string;
	apiEndpoint: string;
	fetch?: typeof globalThis.fetch;
	batchSize?: number;
}

// deno-fmt-ignore
export type ClientFromApplicationBuilder<T extends ApplicationBuilder> = T extends
	ApplicationBuilder<any, infer TRpc, infer TEvent, infer TDocument, infer TCollection, infer TFile, infer TFolder>
	? TypedClient<WithSecurity<TRpc>, WithSecurity<TEvent>, WithSecurity<TDocument>, WithSecurity<TCollection>, WithSecurity<TFile>, WithSecurity<TFolder>>
	: never;

export class Client {
	static fromApplicationBuilder<
		TApplication extends ApplicationBuilder,
	>(initialization: ClientInitialization): ClientFromApplicationBuilder<TApplication> {
		return new Client(initialization) as never;
	}

	#clientId: string;
	#apiEndpoint: string;
	#fetch: typeof globalThis.fetch;
	#batchSize: number;
	#storage: Storage;

	constructor(initialization: ClientInitialization) {
		this.#clientId = initialization.clientId;
		this.#apiEndpoint = initialization.apiEndpoint;
		this.#fetch = initialization.fetch ?? globalThis.fetch;
		this.#batchSize = initialization.batchSize ?? 10;
		this.#storage = new MemoryStorage();
	}

	get storage(): Storage {
		return this.#storage;
	}

	set storage(storage: Storage) {
		this.#storage = storage;
	}

	get profiles(): Profile[] {
		const item = this.#storage.getItem(`bls:${this.#clientId}:profiles`);
		const profiles = JSON.parse(item ?? "[]");
		return Array.isArray(profiles) && profiles.every(isProfile) ? profiles : [];
	}

	switchProfile(index: number): void {
		throw "TODO!";
	}

	#commandCache: Map<string, Promise<unknown>> = new Map();
	#commandQueue: Array<
		{
			command: CommandSingle;
			resolve: (value: unknown | PromiseLike<unknown>) => void;
			reject: (reason?: any) => void;
		}
	> = [];
	#batchTimout: number | null = null;

	async #processCommandQueue(): Promise<void> {
		const commands = this.#commandQueue.splice(0, this.#batchSize);
		try {
			const response = await this.#fetch(this.#apiEndpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					kind: "commands",
					commands: commands.map((c) => c.command),
				}),
			});
			const result = await response.json();
			if (isResults(result)) {
				for (const [index, value] of result.results.entries()) {
					if (isResultSingle(value)) {
						commands[index].resolve(value.value);
					} else {
						commands[index].reject(value.error);
					}
				}
			} else if (isResultError(result)) {
				for (const command of commands) {
					command.reject(result.error);
				}
			} else {
				throw "UnknownError";
			}
		} catch (error) {
			for (const command of commands) {
				command.reject(error);
			}
		}

		if (this.#commandQueue.length > 0) {
			this.#batchTimout = setTimeout(this.#processCommandQueue.bind(this), 0);
		} else {
			this.#batchTimout = null;
		}
	}

	#enqueueCommand(command: CommandSingle): Promise<unknown> {
		const key = stableStringify(command);
		const cachedCommand = this.#commandCache.get(key);
		if (cachedCommand) {
			return cachedCommand;
		}
		const { promise, resolve, reject } = Promise.withResolvers<unknown>();
		this.#commandQueue.push({ command, resolve, reject });
		this.#commandCache.set(key, promise);
		promise.then((_) => this.#commandCache.delete(key));
		if (this.#batchTimout === null) {
			this.#batchTimout = setTimeout(this.#processCommandQueue.bind(this), 0);
		}
		return promise;
	}

	rpc(key: string[], input: unknown): Promise<unknown> {
		return this.#enqueueCommand({
			kind: "command",
			rpc: key,
			input,
		});
	}
}

export interface TypedClient<
	TRpc extends Array<RpcDefinition<any, any, any>> = [],
	TEvent extends Array<EventDefinition<any, any>> = [],
	TDocument extends Array<DocumentDefinition<any, any>> = [],
	TCollection extends Array<CollectionDefinition<any, any>> = [],
	TFile extends Array<unknown> = [],
	TFolder extends Array<unknown> = [],
> extends Client {
	rpc<
		const TRpcPath extends TRpc[number]["matcher"],
		const TRpcDefinition extends PickAtPath<TRpc, TRpcPath>,
	>(
		key: TRpcPath,
		input: Static<TRpcDefinition["input"]>,
	): Promise<Static<TRpcDefinition["output"]>>;
}
