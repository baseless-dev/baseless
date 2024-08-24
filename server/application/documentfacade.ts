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

export class DocumentProviderFacade extends DocumentProvider {
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
		return this.#provider.get(key, options);
	}

	getMany(keys: Array<string[]>, options?: DocumentGetOptions): Promise<Array<Document>> {
		return this.#provider.getMany(keys, options);
	}

	list(options: DocumentListOptions): AsyncIterableIterator<DocumentListEntry> {
		return this.#provider.list(options);
	}

	atomic(): DocumentAtomic {
		return this.#application.getDocumentAtomic({
			context: this.#context,
			provider: this.#provider,
		});
	}
}
