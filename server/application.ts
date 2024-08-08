import { createPathMatcher, PathMatcher } from "@baseless/core/path";
import type {
	CollectionDefinition,
	Context,
	Decorator,
	DocumentAtomicListener,
	DocumentDefinition,
	DocumentListener,
	EventDefinition,
	EventListener,
	IdentityListener,
	RpcDefinition,
} from "./types.ts";
import { Value } from "@sinclair/typebox/value";

export class Application {
	#decorator: ReadonlyArray<Decorator<any, any, any, any>>;
	#rpc: ReadonlyArray<RpcDefinition<any, any, any, any, any, any>>;
	#event: ReadonlyArray<EventDefinition<any, any, any, any, any>>;
	#document: ReadonlyArray<DocumentDefinition<any, any, any, any, any>>;
	#collection: ReadonlyArray<CollectionDefinition<any, any, any, any, any>>;
	#eventListeners: ReadonlyArray<EventListener<any, any, any, any, any>>;
	#documentSavingListeners: ReadonlyArray<DocumentAtomicListener<any, any, any, any, any>>;
	#documentSavedListeners: ReadonlyArray<DocumentListener<any, any, any, any, any>>;
	#documentDeletingListeners: ReadonlyArray<DocumentAtomicListener<any, any, any, any, any>>;
	#documentDeletedListeners: ReadonlyArray<DocumentListener<any, any, any, any, any>>;
	#identityCreatedListeners: ReadonlyArray<IdentityListener<any, any, any>>;
	#identityUpdatedListeners: ReadonlyArray<IdentityListener<any, any, any>>;
	#identityDeletedListeners: ReadonlyArray<IdentityListener<any, any, any>>;
	#rpcMatcher: PathMatcher<RpcDefinition<any, any, any, any, any, any>>;
	#documentMatcher: PathMatcher<DocumentDefinition<any, any, any, any, any>>;
	#collectionMatcher: PathMatcher<CollectionDefinition<any, any, any, any, any>>;

	constructor(
		decorator: ReadonlyArray<Decorator<any, any, any, any>>,
		rpc: ReadonlyArray<RpcDefinition<any, any, any, any, any, any>>,
		event: ReadonlyArray<EventDefinition<any, any, any, any, any>>,
		document: ReadonlyArray<DocumentDefinition<any, any, any, any, any>>,
		collection: ReadonlyArray<CollectionDefinition<any, any, any, any, any>>,
		eventListeners: ReadonlyArray<EventListener<any, any, any, any, any>>,
		documentSavingListeners: ReadonlyArray<DocumentAtomicListener<any, any, any, any, any>>,
		documentSavedListeners: ReadonlyArray<DocumentListener<any, any, any, any, any>>,
		documentDeletingListeners: ReadonlyArray<DocumentAtomicListener<any, any, any, any, any>>,
		documentDeletedListeners: ReadonlyArray<DocumentListener<any, any, any, any, any>>,
		identityCreatedListeners: ReadonlyArray<IdentityListener<any, any, any>>,
		identityUpdatedListeners: ReadonlyArray<IdentityListener<any, any, any>>,
		identityDeletedListeners: ReadonlyArray<IdentityListener<any, any, any>>,
	) {
		this.#decorator = decorator;
		this.#rpc = rpc;
		this.#event = event;
		this.#document = document;
		this.#collection = collection;
		this.#eventListeners = eventListeners;
		this.#documentSavingListeners = documentSavingListeners;
		this.#documentSavedListeners = documentSavedListeners;
		this.#documentDeletingListeners = documentDeletingListeners;
		this.#documentDeletedListeners = documentDeletedListeners;
		this.#identityCreatedListeners = identityCreatedListeners;
		this.#identityUpdatedListeners = identityUpdatedListeners;
		this.#identityDeletedListeners = identityDeletedListeners;
		this.#rpcMatcher = createPathMatcher(rpc);
		this.#documentMatcher = createPathMatcher(document);
		this.#collectionMatcher = createPathMatcher(collection);
	}

	async invokeRpc(options: {
		context: Context<any, any, any>;
		key: string[];
		input: unknown;
		bypassSecurity: boolean;
	}): Promise<unknown> {
		const result = this.#rpcMatcher(options.key);
		if (!result) {
			throw new UnknownRpcError();
		}
		const { value: rpc, params } = result;
		if (!Value.Check(rpc.input, options.input)) {
			throw new InvalidInputError();
		}
		if (!options.bypassSecurity && "security" in rpc) {
			const result = await rpc.security({
				context: options.context,
				params,
				input: options.input,
			});
			if (result !== "allow") {
				throw new ForbiddenError();
			}
		}
		return rpc.handler({ context: options.context, params, input: options.input });
	}
}

export class UnknownRpcError extends Error {}
export class InvalidInputError extends Error {}
export class ForbiddenError extends Error {}
