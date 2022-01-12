import { parse } from "https://deno.land/std@0.120.0/flags/mod.ts";
import { expandGlob } from "https://deno.land/std@0.120.0/fs/expand_glob.ts";
import { build } from "https://deno.land/x/dnt/mod.ts";
import {
	dirname,
	fromFileUrl,
	join,
	relative,
} from "https://deno.land/std@0.120.0/path/mod.ts";

const args = parse(Deno.args);
const supportedRuntime = {
	"browser": 'Browser (script type="module")',
	"deno": "Deno",
	"node-cjs": "Node CommonJS",
	"node-esm": "Node ES Module",
};

function printUsage() {
	console.log(`A universal runtime Typscript builder`);
	console.log(``);
	console.log(
		`USAGE:\n  deno run --unstable -A build.ts`,
	);
	console.log(``);
	console.log(`OPTIONS:`);
	console.log(
		`  --help                   Print help information`,
	);
}

const help = !!args.help;

if (
	help
) {
	printUsage();
} else {
	await buildModule("shared");
	await buildModule("client");
	await buildModule("provider");
	// await buildPackage("provider-mail-sendgrid");
}

// deno-lint-ignore no-explicit-any
async function readPackage(path: string): Promise<any> {
	try {
		return JSON.parse(await readFileAsString(path));
	} catch (err) {
		throw new Error(`Could not load package.json file at ${path}, got ${err}`);
	}
}

async function readFileAsString(path: string): Promise<string> {
	const buffer = await Deno.readFile(path);
	const str = new TextDecoder().decode(buffer);
	return str;
}

async function buildModule(name: string) {
	const src = `./modules/${name}`;
	const dst = `./dist/${name}`;

	const pkg = await readPackage(`${src}/package.json`);

	await Deno.remove(dst, { recursive: true }).catch((_) => {});

	const { main, scripts, dnt, ...originalPackage } = pkg;

	const realMain = join(src, main);

	await build({
		entryPoints: [realMain],
		outDir: dst,
		typeCheck: false,
		skipSourceOutput: true,
		test: false,
		shims: {
			deno: false,
			...(dnt?.shims ?? {}),
		},
		mappings: dnt?.mappings ?? {},
		package: originalPackage,
	});

	console.log("[dbt] Emitting browser ESM modules...");
	await buildBrowser(realMain, dnt?.importMap ?? {}, join(dst, "browser"));

	console.log("[dbt] Emitting Deno modules...");
	await buildDeno(src, join(dst, "deno"));

	console.log("[dbt] Adding Deno and browser export to package.json...");
	const outPkg = await readPackage(`${dst}/package.json`);
	outPkg["deno"] = outPkg["exports"]["."]["deno"] = "./deno/mod.ts";
	outPkg["browser"] = outPkg["exports"]["."]["browser"] = "./browser/mod.js";
	await Deno.writeFile(
		`${dst}/package.json`,
		new TextEncoder().encode(JSON.stringify(outPkg, undefined, `\t`)),
	);

	console.log("[dbt] Removing node_modules...");
	await Deno.remove(join(dst, "node_modules"), { recursive: true });

	console.log("[dbt] Complete!");
}

async function buildBrowser(
	main: string,
	importMap: Record<string, string>,
	outDir: string,
) {
	const { files: emitFiles } = await Deno.emit(main, {
		compilerOptions: {
			sourceMap: false,
		},
	});

	const files: Record<string, string> = {};

	for (let [path, content] of Object.entries(emitFiles)) {
		try {
			path = fromFileUrl(path);
			if (!path.match(/\.js\.map$/)) {
				// TODO use TS compiler API to properly visit import/export statement

				path = relative(dirname(main), path).replace(/\.ts\.js$/, ".js");
				for (const [key, value] of Object.entries(importMap)) {
					content = content.replace(new RegExp(`"${key}`, "g"), `"${value}`);
				}
				content = content.replace(/\.ts"/g, `.js"`);
				files[path] = content;
			}
		} catch (_) {}
	}

	await Deno.remove(outDir, { recursive: true }).catch((_) => {});

	const output: Record<string, string> = {};

	const encoder = new TextEncoder();
	for await (const [path, content] of Object.entries(files)) {
		const dest = join(outDir, path);
		await Deno.mkdir(dirname(dest), { recursive: true });
		await Deno.writeFile(dest, encoder.encode(content));
		output[dest] = content;
	}

	return output;
}

async function buildDeno(
	src: string,
	dst: string,
) {
	for await (
		const entry of expandGlob(join(src, "**/*.{ts,tsx,js,mjs,jsx,json}"))
	) {
		const dest = join(dst, relative(src, entry.path));
		await Deno.mkdir(dirname(dest), { recursive: true });
		await Deno.copyFile(entry.path, dest);
	}
	await Deno.remove(join(dst, "package.json")).catch((_) => {});
}
