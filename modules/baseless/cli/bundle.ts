import { Command } from "https://deno.land/x/cliffy@v0.25.1/mod.ts";
import * as esbuild from "https://deno.land/x/esbuild@v0.15.8/mod.js";
import { join, dirname, isAbsolute, extname } from "https://deno.land/std@0.156.0/path/mod.ts";

const build = new Command()
	.name("Simple bundler")
	.description("A bundler script.")
	.option("--entry <entry:string>", "The entry file", { required: true })
	.option("--config <config:string>", "The Deno config file", { default: './deno.json' })
	.option("--dist <dist:string>", "The distribution directory", { default: './public' })
	.action(async (options) => {

		let importMapBase = "";
		let importMap: { imports: Record<string, string> } | undefined;
		let denoConfig: Record<string, unknown> = {};

		try {
			const denoJson = await Deno.readTextFile(join(Deno.cwd(), options.config));
			denoConfig = JSON.parse(denoJson) ?? {};
		} catch (_err) {}

		if ('importMap' in denoConfig && typeof denoConfig.importMap === 'string') {
			try {
				const importMapPath = join(dirname(join(Deno.cwd(), options.config)), denoConfig.importMap);
				importMapBase = dirname(importMapPath);
				const importMapJson = await Deno.readTextFile(importMapPath);
				importMap = JSON.parse(importMapJson) ?? undefined;
			} catch (_err) {
				importMap = undefined;
			}
		}

		const distPath = join(Deno.cwd(), options.dist);

		const BundleHttpModule: esbuild.Plugin = {
			name: "BundleHttpModule",
			setup(build) {
				build.onResolve({ filter: /^https?:\/\// }, (args) => ({
					path: args.path,
					namespace: "bundle-http",
				}));
				build.onResolve({ filter: /.*/, namespace: "bundle-http" }, (args) => ({
					path: new URL(args.path, args.importer).toString(),
					namespace: "bundle-http",
				}));
				build.onLoad({ filter: /.*/, namespace: 'bundle-http' }, async (args) => {
					for (const [url, map] of Object.entries(importMap?.imports ?? {})) {
						if (args.path.substring(0, url.length) === url) {
							args.path = join(importMapBase, map, args.path.substring(url.length));
							break;
						}
					}
					if (isAbsolute(args.path)) {
						const contents = await Deno.readTextFile(args.path);
						const ext = extname(args.path);
						return { contents, loader: ext.includes('js') ? 'jsx' : 'tsx' };
					} else {
						const response = await fetch(args.path)
						const contents = await response.text();
						const contentType = response.headers.get('Content-Type') ?? 'text/javascript; charset=utf-8';
						return { contents, loader: contentType.includes('javascript') ? 'jsx' : 'tsx' };
					}
				});
			},
		};

		await esbuild.build({
			entryPoints: [join(Deno.cwd(), options.entry)],
			outdir: distPath,
			bundle: true,
			minify: true,
			metafile: true,
			target: "esnext",
			format: "esm",
			platform: "browser",
			plugins: [BundleHttpModule],
			jsxFactory: "h",
			jsxFragment: "Fragment",
		});

		Deno.exit(0);
	})

try {
	await build.parse(Deno.args);
} catch (err) {
	console.error(err);
	Deno.exit(1);
}