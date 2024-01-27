import { contentType, extname, join, normalize, resolve } from "../../deps.ts";
import { createLogger } from "../../lib/logger.ts";
import type { AssetProvider } from "../asset.ts";

export class DenoFSAssetProvider implements AssetProvider {
	#logger = createLogger("asset-denofs");
	#rootDir: string;

	constructor(rootDir: string) {
		this.#rootDir = resolve(rootDir);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		try {
			let filePath = join(this.#rootDir, normalize(url.pathname));
			let stat = await Deno.stat(filePath);
			if (stat.isDirectory && url.pathname.at(-1) === "/") {
				filePath = join(filePath, "/index.html");
				stat = await Deno.stat(filePath);
			}
			if (stat.isFile) {
				const file = await Deno.open(filePath, { read: true });
				return new Response(file.readable, {
					headers: {
						"Content-Type": contentType(extname(filePath)) ??
							"application/octet",
					},
				});
			}
		} catch (inner) {
			this.#logger.debug(`Could not process ${url.pathname}, got ${inner}.`);
		}
		return new Response(null, { status: 404 });
	}
}
