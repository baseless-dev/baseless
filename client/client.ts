import type { Identity } from "@baseless/core/identity";
import type { AuthenticationTokens } from "@baseless/core/authentication-tokens";
import { type ClientInitialization, ClientInternal } from "./internal.ts";
import { AnyDocumentAtomic, RegisteredDocument, RegisteredFetch, RegisteredPubSub } from "./service.ts";
import type { DocumentAtomic, DocumentAtomicCheck, DocumentAtomicOperation } from "@baseless/core/document";

export class Client implements AsyncDisposable {
	#internal: ClientInternal;

	constructor(initialization: ClientInitialization) {
		this.#internal = new ClientInternal(initialization);
		this.fetch = (endpoint, input, signal) => this.#internal.fetch(endpoint, input, signal);
		this.document = {
			get: (path, options, signal) => this.#internal.documentGet(path, options, signal),
			list: (options, signal) => this.#internal.documentList(options, signal),
			getMany: (paths, options, signal) => this.#internal.documentGetMany(paths, options, signal),
			atomic: () => new ClientDocumentAtomic(this.#internal),
		};
		this.pubsub = {
			publish: (path, payload, signal) => this.#internal.pubsubPublish(path, payload, signal),
			subscribe: (path, signal) => this.#internal.pubsubSubscribe(path, signal),
		};
	}

	[Symbol.asyncDispose](): Promise<void> {
		return this.#internal[Symbol.asyncDispose]();
	}

	get clientId(): string {
		return this.#internal.clientId;
	}

	get token(): AuthenticationTokens | undefined {
		return this.#internal.getCurrentToken();
	}

	get identity(): Identity | undefined {
		return this.#internal.getCurrentIdentity();
	}

	setStorage(storage: Storage): void {
		this.#internal.setStorage(storage);
	}

	onAuthenticationStateChange(listener: (identity: Readonly<Identity> | undefined) => void | Promise<void>): Disposable {
		return this.#internal.authEvents.on("onAuthenticationStateChange", listener);
	}

	fetch: RegisteredFetch;
	document: RegisteredDocument;
	pubsub: RegisteredPubSub;
}

class ClientDocumentAtomic implements AnyDocumentAtomic {
	#internal: ClientInternal;
	#checks: DocumentAtomicCheck[] = [];
	#operations: DocumentAtomicOperation[] = [];

	constructor(internal: ClientInternal) {
		this.#internal = internal;
	}

	check(path: string, versionstamp: string | null): AnyDocumentAtomic {
		this.#checks.push({ type: "check", key: path, versionstamp });
		return this;
	}

	set(path: string, value: unknown): AnyDocumentAtomic {
		this.#operations.push({ type: "set", key: path, data: value });
		return this;
	}

	delete(path: string): AnyDocumentAtomic {
		this.#operations.push({ type: "delete", key: path });
		return this;
	}

	commit(): Promise<void> {
		return this.#internal.documentCommit(this.#checks, this.#operations);
	}
}
