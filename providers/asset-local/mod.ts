import {
	extname,
	fromFileUrl,
	join,
	normalize,
	resolve,
} from "https://deno.land/std@0.179.0/path/mod.ts";
import { contentType } from "https://deno.land/std@0.179.0/media_types/mod.ts";
import { AssetProvider } from "../asset.ts";
import { createLogger } from "../../common/system/logger.ts";

export class LocalAssetProvider implements AssetProvider {
	#logger = createLogger("asset-local");
	#rootDir: string;

	constructor(rootDir: string) {
		this.#rootDir = resolve(fromFileUrl(rootDir));
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
