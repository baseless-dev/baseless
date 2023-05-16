import * as esbuild from "https://deno.land/x/esbuild@v0.15.8/mod.js";
import { isAbsolute, join } from "https://deno.land/std@0.179.0/path/mod.ts";

await Deno.remove("./npm", { recursive: true });

const httpCache = await caches.open(import.meta.url);

const BundleWebPlugin: esbuild.Plugin = {
	name: "BundleWebPlugin",
	setup(build) {
		build.onResolve({ filter: /^https?:\/\// }, (args) => {
			let path = args.path;
			let namespace = "bundle-http";
			return {
				path,
				namespace,
			};
		});
		build.onResolve({ filter: /.*?/, namespace: "file" }, (args) => {
			if (!isAbsolute(args.path)) {
				args.path = join(args.resolveDir, args.path);
			}
			return {
				path: args.path,
				namespace: args.namespace,
			};
		});
		build.onResolve({ filter: /.*/, namespace: "bundle-http" }, (args) => ({
			path: new URL(args.path, args.importer).toString(),
			namespace: "bundle-http",
		}));
		build.onLoad(
			{ filter: /.*/, namespace: "bundle-http" },
			async (args) => {
				let response: Response;
				const cached = await httpCache.match(args.path);
				if (cached) {
					response = cached;
				} else {
					response = await fetch(args.path);
					httpCache.put(args.path, response.clone());
				}
				const contents = await response.text();
				const ct = response.headers.get("Content-Type") ??
					"text/javascript; charset=utf-8";
				return {
					contents,
					loader: ct.includes("text/javascript")
						? "js"
						: (ct.includes("text/css") ? "css" : "ts"),
				};
			},
		);
	},
};

await esbuild.build({
	entryPoints: [
		join(Deno.cwd(), "./app.ts"),
		join(Deno.cwd(), "./auth.ts"),
		join(Deno.cwd(), "./errors.ts"),
		join(Deno.cwd(), "./index.ts"),
	],
	chunkNames: 'common/[hash]',
	outdir: join(Deno.cwd(), "npm"),
	bundle: true,
	minify: false,
	metafile: true,
	splitting: true,
	treeShaking: true,
	legalComments: "external",
	sourcemap: "external",
	target: "esnext",
	format: "esm",
	platform: "browser",
	plugins: [BundleWebPlugin],
});

Deno.exit(0);