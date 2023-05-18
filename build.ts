import {
	fromFileUrl,
	globToRegExp,
	join,
	relative,
} from "https://deno.land/std@0.179.0/path/mod.ts";
import { walk } from "https://deno.land/std@0.179.0/fs/walk.ts";
import * as colors from "https://deno.land/std@0.165.0/fmt/colors.ts";
import { emit } from "https://deno.land/x/emit@0.6.0/mod.ts";
import { Project } from "https://deno.land/x/ts_morph@18.0.0/mod.ts";
import { decode } from "https://deno.land/std@0.179.0/encoding/base64.ts";
import { dirname } from "https://deno.land/std@0.179.0/path/win32.ts";

const __dirname = fromFileUrl(new URL(".", import.meta.url));

await Deno.remove(join(__dirname, "./npm"), { recursive: true }).catch(
	(_) => {},
);

const entryPoints = new Array<string>();
for await (
	const entry of walk(__dirname, {
		match: [globToRegExp("**/*.ts")],
		skip: [
			globToRegExp(join(__dirname, "**/*.test.ts")),
			globToRegExp(
				join(
					__dirname,
					"{.deno,auth,cli,coverage,examples,npm,providers,server}/**/*",
				),
			),
			/build\.ts/,
		],
	})
) {
	entryPoints.push(entry.path);
}

const textDecoder = new TextDecoder();

const timeStart = performance.now();
console.log(
	`${colors.green(colors.bold(`PetiteVITE`) + ` v0.0.0`)} ${
		colors.blue("building for production...")
	}`,
);

const project = new Project({
	compilerOptions: {
		outDir: join(__dirname, "npm"),
		declaration: true,
		emitDeclarationOnly: true,
	},
});
for await (const entryPoint of entryPoints) {
	project.addSourceFileAtPath(entryPoint);
	const outputPath = join(__dirname, "npm/", relative(__dirname, entryPoint));
	await Deno.mkdir(dirname(outputPath), { recursive: true });
	await Deno.copyFile(entryPoint, outputPath);
}
await project.emit();
const outputPaths: string[] = [];
await Promise.allSettled(entryPoints.map(async (entryPoint) => {
	const url = new URL(`file://${entryPoint}`);
	const result = await emit(url);
	const contents = result[url.href].replace(/\/\/# sourceMappingURL=.+$/, "")
		.replace(/"(.*)\.ts"/g, '"$1.mjs"');
	const encodedSourceMap = result[url.href].match(/\/\/# sourceMappingURL=.+$/)
		?.[0].replace(/\/\/# sourceMappingURL=/, "");
	const outputPath = join(__dirname, "npm/", relative(__dirname, entryPoint));
	const modulePath = outputPath.replace(/\.ts$/, ".mjs");
	await Deno.writeTextFile(modulePath, contents);
	if (encodedSourceMap) {
		const sourceMapPath = outputPath.replace(/\.ts$/, ".mjs.map");
		const sourceMap = JSON.parse(
			textDecoder.decode(decode(encodedSourceMap.split(",").pop()!)),
		);
		sourceMap.sources = sourceMap.sources.map((source: string) =>
			relative(__dirname, fromFileUrl(source))
		);
		// TODO remap paths
		await Deno.writeTextFile(
			sourceMapPath,
			JSON.stringify(sourceMap, undefined, "  "),
		);
	}
	outputPaths.push(modulePath);
}));
console.log(
	colors.green("✓") +
		colors.dim(
			` ${entryPoints.length} modules transformed in ${
				(performance.now() - timeStart).toFixed(0)
			}ms.`,
		),
);

const clientRegExp = globToRegExp(join(__dirname, "npm/client/**/*"));

await Deno.writeTextFile(
	join(__dirname, "npm/package.json"),
	JSON.stringify(
		{
			name: "@baseless/client",
			version: "0.0.0",
			description: "Baseless JS client",
			repository: {
				type: "git",
				url: "git+https://github.com/baseless-dev/baseless",
			},
			browser: "client/index.mjs",
			types: "client/index.d.ts",
			exports: Object.fromEntries(
				outputPaths.filter((outputPath) => clientRegExp.test(outputPath)).map(
					(outputPath) => {
						const browser = "./" + relative(join(__dirname, "npm"), outputPath);
						const key = browser === "./client/index.mjs" ? "." : browser;
						return [key, {
							browser,
							deno: browser.replace(/\.mjs$/, ".ts"),
							types: browser.replace(/\.mjs$/, ".d.ts"),
						}];
					},
				),
			),
		},
		undefined,
		"  ",
	),
);

Deno.exit(0);
