import { Command } from "https://deno.land/x/cliffy@v0.25.1/mod.ts";
import * as esbuild from "https://deno.land/x/esbuild@v0.15.8/mod.js";
import Processor from "https://esm.sh/v115/windicss@3.5.6";
import { CSSParser } from "https://esm.sh/v115/windicss@3.5.6/utils/parser";
import { dirname, extname, isAbsolute, join, relative, fromFileUrl } from "https://deno.land/std@0.179.0/path/mod.ts";
import { contentType } from "https://deno.land/std@0.157.0/media_types/mod.ts";
import * as ansi from "https://deno.land/x/ansi@1.0.1/mod.ts";
import * as colors from "https://deno.land/std@0.165.0/fmt/colors.ts";
import { prettyBytes } from "https://deno.land/x/pretty_bytes@v2.0.0/mod.ts";

const cwd = fromFileUrl(import.meta.resolve("./"));

async function build(onRebuild?: () => void) {
	const isDev = !!onRebuild;

	const processor = new Processor({
		darkMode: "class",
	});
	const preflight = processor.preflight();

	async function processCSS(metafile?: esbuild.Metafile) {
		if (metafile) {
			for await (const path of Object.keys(metafile.outputs)) {
				if (path.match(/\.css$/i)) {
					const input = await Deno.readTextFile(path);
					const parser = new CSSParser(input, processor);
					const sheet = parser.parse();
					const output = sheet.extend(preflight).build(!isDev);
					await Deno.writeTextFile(path, output);
				}
			}
		}
	}

	const result = await esbuild.build({
		entryPoints: [
			join(cwd, "src/index.html"),
			join(cwd, "src/index.tsx"),
		],
		outdir: join(cwd, "dist"),
		bundle: true,
		minify: !isDev,
		metafile: true,
		incremental: isDev,
		treeShaking: !isDev,
		// sourcemap: isDev ? "linked" : "external",
		sourcemap: "linked",
		watch: isDev
			? {
				async onRebuild(_error, result) {
					await processCSS(result?.metafile);
					onRebuild?.();
				},
			}
			: false,
		target: "esnext",
		format: "esm",
		platform: "browser",
		plugins: [BundleWebPlugin],
		jsx: "automatic",
		jsxImportSource: "https://esm.sh/preact@10.13.2",
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

	await processCSS(result.metafile);

	return result;
}

async function dev(port: number) {
	const startTime = performance.now();

	const _builder = await build(() => {
		for (const socket of subscribers) {
			socket.send("refresh");
		}
	});

	const listener = Deno.listen({ port });
	const subscribers = new Set<WebSocket>();

	console.log(ansi.clearScreen());
	console.log(`  ${colors.green(colors.bold(`PetiteVITE`) + ` v0.0.0`)}  ${colors.dim("ready in")} ${(performance.now() - startTime).toFixed(0)}ms`);
	console.log(``);
	console.log(`  ${colors.green("➜")}  ${colors.bold("Local")}: ${colors.blue(`http://localhost:${port}/`)}`);
	console.log(``);

	async function handleRequest(conn: Deno.Conn) {
		const http = Deno.serveHttp(conn);
		for await (const event of http) {
			const url = new URL(event.request.url);
			const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
			let response = new Response(null, { status: 404 });
			try {
				if (pathname === "/refresh") {
					const result = Deno.upgradeWebSocket(event.request);
					response = result.response;
					subscribers.add(result.socket);
					result.socket.onclose = () => {
						subscribers.delete(result.socket);
					};
				} else if (pathname === "/hmr.js") {
					let content = function () {
						const requestUrl = `${window.location.origin.replace("http", "ws")}/refresh`;
						function connect() {
							const socket = new WebSocket(requestUrl);
							socket.addEventListener("message", (e) => {
								if (e.data === "refresh") {
									console.log(`HMR RELOAD`);
									window.location.reload();
								}
							});
							socket.addEventListener("close", () => {
								setTimeout(connect, 2000);
							});
						}
						connect();
					}.toString();
					content = content.substring(13, content.length - 1);
					response = new Response(content, {
						headers: {
							"Content-Type": contentType(".js")!,
						},
					});
				} else if (pathname === "/index.html") {
					let content = await Deno.readTextFile(join(cwd, "dist/index.html"));
					content = content.replace("</body>", '<script src="/hmr.js"></script></body>');
					response = new Response(content, {
						headers: {
							"Content-Type": contentType(".html")!,
						},
					});
				} else {
					try {
						const path = join(cwd, "dist", pathname);
						const file = await Deno.open(path, { read: true, create: false });
						response = new Response(file.readable, {
							headers: {
								"Content-Type": contentType(extname(path)) ?? "application/octet",
							},
						});
					} catch {
						response = new Response(null, { status: 404 });
					}
				}
			} catch (error) {
				console.error(error);
				response = new Response(null, { status: 500 });
			}
			try {
				await event.respondWith(response);
			} catch (err) {
				console.error(`${new Date().toISOString()} ${event.request.method} ${pathname} - ${999} ${err}`);
			}
		}
	}

	for await (const conn of listener) {
		handleRequest(conn).catch(console.error);
	}
}

const httpCache = await caches.open(import.meta.url);
const importMapBase = "";
const importMap: { imports: Record<string, string> } = { imports: {} };
// try {
// 	const denoJson = await Deno.readTextFile(join(cwd, "deno.json"));
// 	const denoConfig = JSON.parse(denoJson) ?? {};
// 	if ("importMap" in denoConfig && typeof denoConfig.importMap === "string") {
// 		try {
// 			const importMapPath = join(dirname(join(cwd, "deno.json")), denoConfig.importMap);
// 			importMapBase = dirname(importMapPath);
// 			const importMapJson = await Deno.readTextFile(importMapPath);
// 			importMap = JSON.parse(importMapJson) ?? undefined;
// 		} catch {
// 			// Ignored
// 		}
// 	}
// } catch {
// 	// Ignored
// }
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
			const ct = response.headers.get("Content-Type") ?? "text/javascript; charset=utf-8";
			return { contents, loader: ct.includes("text/javascript") ? "jsx" : (ct.includes("text/css") ? "css" : "tsx") };
		});
	},
};

await new Command()
	.name("pxlr")
	.command("build", "Build project")
	.action(async () => {
		const timeStart = performance.now();
		console.log(`${colors.green(colors.bold(`PetiteVITE`) + ` v0.0.0`)} ${colors.blue("building for production...")}`);
		const result = await build();
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

			const dist = join(cwd, "dist");
			console.log(
				colors.dim(relative(Deno.cwd(), dist) + "/") + color(relative(dist, path)) +
				colors.dim(` (${prettyBytes(stat.size)} ⇒ ${prettyBytes(compressed.byteLength)})`),
			);

			const sortedDeps = Object.entries(meta.inputs);
			sortedDeps.sort((a, b) => b[1].bytesInOutput - a[1].bytesInOutput);

			if (sortedDeps.length > 0) {
				const moduleCount = sortedDeps.length;
				let i = 0;
				const biggestOffenders = sortedDeps.splice(0, 4);
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
	})
	.command("dev", "Launch dev server")
	.option("-p, --port <port:number>", "The port number", { default: 8000 })
	.action(({ port }) => dev(port))
	.parse(Deno.args);