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
		return this.#application.getDocument({
			context: this.#context,
			provider: this.#provider,
			key,
			options,
		});
	}

	getMany(keys: Array<string[]>, options?: DocumentGetOptions): Promise<Array<Document>> {
		return this.#application.getManyDocument({
			context: this.#context,
			provider: this.#provider,
			keys,
			options,
		});
	}

	list(options: DocumentListOptions): AsyncIterableIterator<DocumentListEntry> {
		return this.#application.listCollection({
			context: this.#context,
			provider: this.#provider,
			options,
		});
	}

	atomic(): DocumentAtomic {
		return this.#application.atomicDocument({
			context: this.#context,
			provider: this.#provider,
		});
	}
}
