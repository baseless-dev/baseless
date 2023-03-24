import { Command } from "https://deno.land/x/cliffy@v0.25.1/mod.ts";
import * as esbuild from "https://deno.land/x/esbuild@v0.15.8/mod.js";
import { dirname, extname, isAbsolute, join } from "https://deno.land/std@0.179.0/path/mod.ts";
// import * as ansi from "https://deno.land/x/ansi@1.0.1/mod.ts";
import * as colors from "https://deno.land/std@0.165.0/fmt/colors.ts";
import { prettyBytes } from "https://deno.land/x/pretty_bytes@v2.0.0/mod.ts";

const build = new Command()
	.name("Simple bundler")
	.description("A bundler script.")
	.option("--entry <entry:string>", "The entry file", { required: true })
	.option("--config <config:string>", "The Deno config file", { default: "./deno.json" })
	.option("--dist <dist:string>", "The distribution directory", { default: "./public" })
	.action(async (options) => {
		const httpCache = await caches.open(import.meta.url);
		let importMapBase = "";
		let importMap: { imports: Record<string, string> } = { imports: {} };
		try {
			const denoJson = await Deno.readTextFile(join(Deno.cwd(), options.config));
			const denoConfig = JSON.parse(denoJson) ?? {};
			if ("importMap" in denoConfig && typeof denoConfig.importMap === "string") {
				try {
					const importMapPath = join(dirname(join(Deno.cwd(), options.config)), denoConfig.importMap);
					importMapBase = dirname(importMapPath);
					const importMapJson = await Deno.readTextFile(importMapPath);
					importMap = JSON.parse(importMapJson) ?? undefined;
				} catch {
					// Ignored
				}
			}
		} catch {
			// Ignored
		}

		const BundleWebPlugin: esbuild.Plugin = {
			name: "BundleWebPlugin",
			setup(build) {
				build.onResolve({ filter: /^https?:\/\// }, (args) => {
					let path = args.path;
					let namespace = "bundle-http";
					for (const [url, map] of Object.entries(importMap?.imports ?? {})) {
						if (args.path.substring(0, url.length) === url) {
							path = join(map, args.path.substring(url.length));
							if (!isAbsolute(path)) {
								path = join(Deno.cwd(), path);
								namespace = "file";
							}
							break;
						}
					}
					return {
						path,
						namespace,
					};
				});
				build.onResolve({ filter: /.*?/, namespace: "file" }, (args) => {
					for (const [url, map] of Object.entries(importMap?.imports ?? {})) {
						if (args.path.substring(0, url.length) === url) {
							args.path = join(importMapBase, map, args.path.substring(url.length));
							break;
						}
					}
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
				build.onLoad({ filter: /.*/, namespace: "bundle-http" }, async (args) => {
					let response: Response;
					const cached = await httpCache.match(args.path);
					if (cached) {
						response = cached;
					} else {
						response = await fetch(args.path);
						httpCache.put(args.path, response.clone());
					}
					const contents = await response.text();
					const ct = response.headers.get("Content-Type") ?? "text/javascript; charset=utf-8";
					return { contents, loader: ct.includes("text/javascript") ? "js" : (ct.includes("text/css") ? "css" : "ts") };
				});
			},
		};

		const timeStart = performance.now();
		console.log(`${colors.green(colors.bold(`PetiteVITE`) + ` v0.0.0`)} ${colors.blue("building for production...")}`);
		const result = await esbuild.build({
			entryPoints: [join(Deno.cwd(), options.entry)],
			outdir: join(Deno.cwd(), options.dist),
			bundle: true,
			minify: true,
			metafile: true,
			legalComments: "external",
			treeShaking: true,
			sourcemap: "external",
			target: "esnext",
			format: "esm",
			platform: "browser",
			plugins: [BundleWebPlugin],
		});
		console.log(colors.green("✓") + colors.dim(` ${Object.keys(result.metafile!.inputs).length} modules transformed in ${(performance.now() - timeStart).toFixed(0)}ms.`));
		const outouts = result.metafile!.outputs;
		const sortedOutput = Object.entries(outouts);
		sortedOutput.sort((a, b) => a[0].localeCompare(b[0]));
		for await (const [path, meta] of sortedOutput) {
			let color = colors.yellow;
			const ext = extname(path);
			if (ext === ".html") {
				color = colors.green;
			} else if (ext === ".css") {
				color = colors.magenta;
			} else if (ext === ".js") {
				color = colors.blue;
			}
			const file = await Deno.open(path);
			const stat = await file.stat();
			const compressed = await new Response(file.readable.pipeThrough(new CompressionStream("gzip"))).arrayBuffer();

			console.log(
				color(path) +
				colors.dim(` (${prettyBytes(stat.size)} ⇒ ${prettyBytes(compressed.byteLength)})`),
			);

			const sortedDeps = Object.entries(meta.inputs);
			sortedDeps.sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput);

			if (sortedDeps.length > 0) {
				const moduleCount = sortedDeps.length;
				let i = 0;
				const biggestOffenders = sortedDeps.splice(0, 5);
				for (const [dep, { bytesInOutput }] of biggestOffenders) {
					console.log(colors.dim(`  ${++i >= moduleCount ? "└" : "├"} ${dep.replace("bundle-http:", "")} (${prettyBytes(bytesInOutput)})`));
				}
				if (sortedDeps.length) {
					const depSize = prettyBytes(sortedDeps.reduce((size, dep) => size + dep[1].bytesInOutput, 0));
					console.log(colors.dim(`  └ and ${colors.underline(`${sortedDeps.length} others modules`)} (${depSize})`));
				}
			}
		}
		Deno.exit(0);
	});

try {
	await build.parse(Deno.args);
} catch (err) {
	console.error(err);
	Deno.exit(1);
}
