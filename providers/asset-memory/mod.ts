import { createLogger } from "../../lib/logger.ts";
import type { AssetProvider } from "../asset.ts";

export interface MemoryAssetEntry {
	body:
		| ReadableStream
		| Blob
		| BufferSource
		| FormData
		| URLSearchParams
		| string;
	contentType?: string;
}

export class MemoryAssetProvider implements AssetProvider {
	#logger = createLogger("asset-memory");
	#entries: Map<string, MemoryAssetEntry>;

	constructor(entries?: Iterable<[string, MemoryAssetEntry]>) {
		this.#entries = new Map(entries ?? []);
	}

	// deno-lint-ignore require-await
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		url.pathname = url.pathname.at(-1) === "/"
			? url.pathname + "index.html"
			: url.pathname;
		if (this.#entries.has(url.pathname)) {
			const { body, contentType } = this.#entries.get(url.pathname)!;
			const headers = new Headers();
			if (contentType) {
				headers.set("Content-Type", contentType);
			}
			return new Response(body, { headers });
		}
		return new Response(null, { status: 404 });
	}
}
