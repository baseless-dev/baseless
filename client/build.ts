import * as esbuild from "https://deno.land/x/esbuild@v0.15.8/mod.js";
import { isAbsolute, join, fromFileUrl, extname } from "https://deno.land/std@0.179.0/path/mod.ts";
// import * as ansi from "https://deno.land/x/ansi@1.0.1/mod.ts";
import * as colors from "https://deno.land/std@0.165.0/fmt/colors.ts";
import { prettyBytes } from "https://deno.land/x/pretty_bytes@v2.0.0/mod.ts";

const __dirname = fromFileUrl(new URL(".", import.meta.url));

await Deno.remove(join(__dirname, "./npm"), { recursive: true }).catch(_ => { });

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

const timeStart = performance.now();
console.log(
	`${colors.green(colors.bold(`PetiteVITE`) + ` v0.0.0`)} ${colors.blue("building for production...")
	}`,
);
const result = await esbuild.build({
	entryPoints: [
		join(__dirname, "./app.ts"),
		join(__dirname, "./auth.ts"),
		join(__dirname, "./errors.ts"),
		join(__dirname, "./index.ts"),
	],
	chunkNames: 'common/[hash]',
	outdir: join(__dirname, "npm"),
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

console.log(
	colors.green("✓") +
	colors.dim(
		` ${Object.keys(result.metafile!.inputs).length
		} modules transformed in ${(performance.now() - timeStart).toFixed(0)
		}ms.`,
	),
);
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
	const compressed = await new Response(
		file.readable.pipeThrough(new CompressionStream("gzip")),
	).arrayBuffer();

	console.log(
		color(path) +
		colors.dim(
			` (${prettyBytes(stat.size)} ⇒ ${prettyBytes(compressed.byteLength)
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
					`  ${++i >= moduleCount ? "└" : "├"} ${dep.replace("bundle-http:", "")
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
					`  └ and ${colors.underline(`${sortedDeps.length} others modules`)
					} (${depSize})`,
				),
			);
		}
	}
}
Deno.exit(0);