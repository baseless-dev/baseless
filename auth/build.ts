import { Command } from "https://deno.land/x/cliffy@v0.25.1/mod.ts";
import * as esbuild from "https://deno.land/x/esbuild@v0.15.8/mod.js";
import {
	extname,
	fromFileUrl,
	isAbsolute,
	join,
	relative,
} from "https://deno.land/std@0.179.0/path/mod.ts";
import * as ansi from "https://deno.land/x/ansi@1.0.1/mod.ts";
import * as colors from "https://deno.land/std@0.165.0/fmt/colors.ts";
import { prettyBytes } from "https://deno.land/x/pretty_bytes@v2.0.0/mod.ts";

const __DIR__ = fromFileUrl(import.meta.resolve("./"));

async function build(
	out: string,
	onRebuild?: (result: esbuild.BuildResult) => void,
) {
	const isDev = !!onRebuild;

	async function runTailwind() {
		const command = new Deno.Command(Deno.execPath(), {
			args: [
				"run",
				"-A",
				"npm:tailwindcss",
				"-c",
				join(__DIR__, "tailwind.config.js"),
				"-i",
				join(__DIR__, "index.css"),
				"-o",
				join(Deno.cwd(), out, "index.css"),
			],
			stdin: "null",
			stdout: "null",
			stderr: "null",
		});
		await command.output();
	}

	const result = await esbuild.build({
		entryPoints: [
			join(__DIR__, "index.html"),
			join(__DIR__, "index.tsx"),
		],
		outdir: join(Deno.cwd(), out),
		bundle: true,
		minify: !isDev,
		metafile: true,
		incremental: isDev,
		treeShaking: !isDev,
		sourcemap: isDev ? "linked" : "external",
		watch: isDev
			? {
				async onRebuild(_error, result) {
					await runTailwind();
					result!.metafile!.outputs[join(out, "index.css")] = {
						bytes: 0,
						exports: [],
						inputs: {},
						imports: [],
					};
					onRebuild?.(result!);
				},
			}
			: false,
		target: "esnext",
		format: "esm",
		platform: "browser",
		plugins: [BundleWebPlugin],
		jsx: "automatic",
		jsxImportSource: "https://esm.sh/react@18.2.0",
		logLevel: "error",
		loader: {
			".js": "js",
			".jsx": "jsx",
			".ts": "ts",
			".tsx": "tsx",
			".css": "css",
			".html": "copy",
		},
	});

	await runTailwind();
	result!.metafile!.outputs[join(out, "index.css")] = {
		bytes: 0,
		exports: [],
		inputs: {},
		imports: [],
	};
	return result;
}

async function dev(out: string) {
	const startTime = performance.now();

	const _builder = await build(out, (result) => {
		const outputLen = Object.keys(result.metafile!.outputs).length;
		console.log(
			`  ${colors.green("➜")}  ${
				colors.bold(`${outputLen} file${outputLen > 1 ? "s" : ""} refreshed`)
			}`,
		);
		console.log(``);
	});

	console.log(ansi.clearScreen());
	console.log(
		`  ${colors.green(colors.bold(`PetiteVITE`) + ` v0.0.0`)}  ${
			colors.dim("ready in")
		} ${(performance.now() - startTime).toFixed(0)}ms`,
	);
	console.log(``);
	console.log(`  ${colors.green("➜")}  ${colors.bold("Waiting for changes")}`);
	console.log(``);
}

const httpCache = await caches.open(import.meta.url);
const importMapBase = "";
const importMap: { imports: Record<string, string> } = { imports: {} };
const BundleWebPlugin: esbuild.Plugin = {
	name: "BundleWebPlugin",
	setup(build) {
		build.onResolve({ filter: /^https?:\/\// }, (args) => {
			for (const [url, map] of Object.entries(importMap?.imports ?? {})) {
				if (args.path.substring(0, url.length) === url) {
					args.path = join(map, args.path.substring(url.length));
					break;
				}
			}
			return {
				path: args.path,
				namespace: "bundle-http",
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
			const ct = response.headers.get("Content-Type") ??
				"text/javascript; charset=utf-8";
			return {
				contents,
				loader: ct.includes("text/javascript")
					? "jsx"
					: (ct.includes("text/css") ? "css" : "tsx"),
			};
		});
	},
};

await new Command()
	.name("pxlr")
	.command("build", "Build project")
	.option("-o, --out <out:string>", "Output directory", { default: "./dist" })
	.action(async ({ out }) => {
		const timeStart = performance.now();
		console.log(
			`${colors.green(colors.bold(`PetiteVITE`) + ` v0.0.0`)} ${
				colors.blue("building for production...")
			}`,
		);
		const result = await build(out);
		console.log(
			colors.green("✓") +
				colors.dim(
					` ${
						Object.keys(result.metafile!.inputs).length
					} modules transformed in ${
						(performance.now() - timeStart).toFixed(0)
					}ms.`,
				),
		);
		const outputs = result.metafile!.outputs;
		const sortedOutput = Object.entries(outputs);
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
			const compressed = await new Response(
				file.readable.pipeThrough(new CompressionStream("gzip")),
			).arrayBuffer();

			const dist = join(Deno.cwd(), out);
			console.log(
				colors.dim(relative(Deno.cwd(), dist) + "/") +
					color(relative(dist, path)) +
					colors.dim(
						` (${prettyBytes(stat.size)} ⇒ ${
							prettyBytes(compressed.byteLength)
						})`,
					),
			);

			const sortedDeps = Object.entries(meta.inputs);
			sortedDeps.sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput);

			if (sortedDeps.length > 0) {
				const moduleCount = sortedDeps.length;
				let i = 0;
				const biggestOffenders = sortedDeps.splice(0, 4);
				for (const [dep, { bytesInOutput }] of biggestOffenders) {
					console.log(
						colors.dim(
							`  ${++i >= moduleCount ? "└" : "├"} ${
								dep.replace("bundle-http:", "")
							} (${prettyBytes(bytesInOutput)})`,
						),
					);
				}
				if (sortedDeps.length) {
					const depSize = prettyBytes(
						sortedDeps.reduce((size, dep) => size + dep[1].bytesInOutput, 0),
					);
					console.log(
						colors.dim(
							`  └ and ${
								colors.underline(`${sortedDeps.length} others modules`)
							} (${depSize})`,
						),
					);
				}
			}
		}
		Deno.exit(0);
	})
	.command("watch", "Watch project")
	.option("-o, --out <out:string>", "Output directory", { default: "./dist" })
	.action(({ out }) => dev(out))
	.parse(Deno.args);
