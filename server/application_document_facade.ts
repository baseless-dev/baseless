// deno-lint-ignore-file no-explicit-any
import { Document } from "@baseless/core/document";
import { Application } from "./application.ts";
import { TypedContext } from "./types.ts";
import { DocumentAtomic, DocumentGetOptions, DocumentListEntry, DocumentListOptions, DocumentProvider } from "./document_provider.ts";
import { EventProvider } from "./event_provider.ts";

export class ApplicationDocumentProviderFacade extends DocumentProvider {
	#application: Application;
	#context: TypedContext<any, any, any, any>;
	#documentProvider: DocumentProvider;
	#eventProvider: EventProvider;

	constructor(
		application: Application,
		context: TypedContext<any, any, any, any>,
		documentProvider: DocumentProvider,
		eventProvider: EventProvider,
	) {
		super();
		this.#application = application;
		this.#context = context;
		this.#documentProvider = documentProvider;
		this.#eventProvider = eventProvider;
	}

	get(key: string[], options?: DocumentGetOptions): Promise<Document> {
		return this.#application.getDocument({
			bypassSecurity: true,
			context: this.#context,
			options,
			path: key,
			provider: this.#documentProvider,
		});
	}

	getMany(keys: Array<string[]>, options?: DocumentGetOptions): Promise<Array<Document>> {
		return this.#application.getManyDocument({
			bypassSecurity: true,
			context: this.#context,
			options,
			paths: keys,
			provider: this.#documentProvider,
		});
	}

	async *list(options: DocumentListOptions): AsyncIterableIterator<DocumentListEntry> {
		yield* this.#application.listDocument({
			bypassSecurity: true,
			context: this.#context,
			cursor: options.cursor,
			limit: options.limit,
			prefix: options.prefix,
			provider: this.#documentProvider,
		});
	}

	atomic(): DocumentAtomic {
		return new ApplicationDocumentAtomicFacade(
			this.#application,
			this.#context,
			this.#documentProvider,
			this.#eventProvider,
		);
	}
}

export class ApplicationDocumentAtomicFacade extends DocumentAtomic {
	#application: Application;
	#context: TypedContext<any, any, any, any>;
	#documentProvider: DocumentProvider;
	#eventProvider: EventProvider;

	constructor(
		application: Application,
		context: TypedContext<any, any, any, any>,
		documentProvider: DocumentProvider,
		eventProvider: EventProvider,
	) {
		super();
		this.#application = application;
		this.#context = context;
		this.#documentProvider = documentProvider;
		this.#eventProvider = eventProvider;
	}

	commit(): Promise<void> {
		return this.#application.commitDocumentAtomic({
			bypassSecurity: true,
			checks: this.checks,
			context: this.#context,
			documentProvider: this.#documentProvider,
			eventProvider: this.#eventProvider,
			operations: this.operations,
		});
	}
}
