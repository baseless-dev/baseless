// deno-lint-ignore-file no-explicit-any
import { Document } from "@baseless/core/document";
import { Application } from "./application.ts";
import { Context } from "./types.ts";
import {
	DocumentAtomic,
	DocumentGetOptions,
	DocumentListEntry,
	DocumentListOptions,
	DocumentProvider,
} from "../provider/mod.ts";

export class ApplicationDocumentProviderFacade extends DocumentProvider {
	#application: Application;
	#context: Context<any, any, any>;
	#provider: DocumentProvider;

	constructor(
		application: Application,
		context: Context<any, any, any>,
		provider: DocumentProvider,
	) {
		super();
		this.#application = application;
		this.#context = context;
		this.#provider = provider;
	}

	get(key: string[], options?: DocumentGetOptions): Promise<Document> {
		return this.#application.getDocument({
			bypassSecurity: true,
			context: this.#context,
			options,
			path: key,
			provider: this.#provider,
		});
	}

	getMany(keys: Array<string[]>, options?: DocumentGetOptions): Promise<Array<Document>> {
		return this.#application.getManyDocument({
			bypassSecurity: true,
			context: this.#context,
			options,
			paths: keys,
			provider: this.#provider,
		});
	}

	async *list(options: DocumentListOptions): AsyncIterableIterator<DocumentListEntry> {
		yield* this.#application.listDocument({
			bypassSecurity: true,
			context: this.#context,
			cursor: options.cursor,
			limit: options.limit,
			prefix: options.prefix,
			provider: this.#provider,
		});
	}

	atomic(): DocumentAtomic {
		return new ApplicationDocumentAtomicFacade(
			this.#application,
			this.#context,
			this.#provider,
		);
	}
}

export class ApplicationDocumentAtomicFacade extends DocumentAtomic {
	#application: Application;
	#context: Context<any, any, any>;
	#provider: DocumentProvider;

	constructor(
		application: Application,
		context: Context<any, any, any>,
		provider: DocumentProvider,
	) {
		super();
		this.#application = application;
		this.#context = context;
		this.#provider = provider;
	}

	commit(): Promise<void> {
		return this.#application.commitDocumentAtomic({
			bypassSecurity: true,
			checks: this.checks,
			context: this.#context,
			provider: this.#provider,
			operations: this.operations,
		});
	}
}
