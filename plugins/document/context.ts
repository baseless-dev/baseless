import type { DocumentService } from "./document.ts";

export interface DocumentContext {
	readonly document: DocumentService;
}
