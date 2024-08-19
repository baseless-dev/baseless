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
import { isResultError, isResultSingle } from "@baseless/core/result";
import { isPersistence, isProfile, Persistence, Profile } from "./types.ts";
import MemoryStorage from "./memory_storage.ts";

export interface ClientInitialization {
	clientId: string;
	apiEndpoint: string;
	fetch?: typeof globalThis.fetch;
	batchSize?: number;
}

// deno-fmt-ignore
export type ClientFromApplicationBuilder<T extends ApplicationBuilder> = T extends
	ApplicationBuilder<any, infer TRpc, infer TEvent, infer TDocument, infer TCollection, infer TFile, infer TFolder>
	? Client<WithSecurity<TRpc>, WithSecurity<TEvent>, WithSecurity<TDocument>, WithSecurity<TCollection>, WithSecurity<TFile>, WithSecurity<TFolder>>
	: never;

export class Client<
	TRpc extends Array<RpcDefinition<any, any, any>> = [],
	TEvent extends Array<EventDefinition<any, any>> = [],
	TDocument extends Array<DocumentDefinition<any, any>> = [],
	TCollection extends Array<CollectionDefinition<any, any>> = [],
	TFile extends Array<unknown> = [],
	TFolder extends Array<unknown> = [],
> {
	static fromApplicationBuilder<
		TApplication extends ApplicationBuilder,
	>(initialization: ClientInitialization): ClientFromApplicationBuilder<TApplication> {
		return new Client(initialization) as never;
	}

	#clientId: string;
	#apiEndpoint: string;
	#fetch: typeof globalThis.fetch;
	#batchSize: number;
	#persistence: Persistence;
	#storage: Storage;

	constructor(initialization: ClientInitialization) {
		this.#clientId = initialization.clientId;
		this.#apiEndpoint = initialization.apiEndpoint;
		this.#fetch = initialization.fetch ?? globalThis.fetch;
		this.#batchSize = initialization.batchSize ?? 10;
		const savedPersistence = globalThis.localStorage.getItem(
			`baseless_${this.#clientId}_persistence`,
		);
		this.#persistence = isPersistence(savedPersistence) ? savedPersistence : "memory";
		this.#storage = this.#persistence === "local"
			? globalThis.localStorage
			: this.#persistence === "session"
			? globalThis.sessionStorage
			: new MemoryStorage();
	}

	get profiles(): Profile[] {
		const item = this.#storage.getItem(`baseless_${this.#clientId}_profiles`);
		const profiles = JSON.parse(item ?? "[]");
		return Array.isArray(profiles) && profiles.every(isProfile) ? profiles : [];
	}

	switchProfile(index: number): void {
		throw "TODO!";
	}

	async rpc<
		const TRpcPath extends TRpc[number]["matcher"],
		const TRpcDefinition extends PickAtPath<TRpc, TRpcPath>,
	>(
		key: TRpcPath,
		input: Static<TRpcDefinition["input"]>,
	): Promise<Static<TRpcDefinition["output"]>> {
		const response = await this.#fetch(this.#apiEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				kind: "command",
				rpc: key,
				input,
			}),
		});

		const result = await response.json();

		if (isResultError(result)) {
			throw result.error;
		} else if (isResultSingle(result)) {
			return result.value;
		} else {
			throw "TODO!";
		}
	}
}
