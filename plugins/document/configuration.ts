import type { DocumentProvider } from "../../providers/document/provider.ts";

export class DocumentConfiguration {
	#documentProvider?: DocumentProvider;

	constructor(documentProvider?: DocumentProvider) {
		this.#documentProvider = documentProvider;
	}

	setDocumentProvider(documentProvider: DocumentProvider): DocumentConfiguration {
		return new DocumentConfiguration(documentProvider);
	}

	// deno-lint-ignore explicit-function-return-type
	build() {
		if (!this.#documentProvider) {
			throw new Error("A Document provider must be provided.");
		}
		return Object.freeze({
			documentProvider: this.#documentProvider,
		});
	}
}
