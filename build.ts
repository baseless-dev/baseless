import ts from "npm:typescript";
import {
	dirname,
	fromFileUrl,
	globToRegExp,
	join,
	relative,
} from "https://deno.land/std@0.213.0/path/mod.ts";
import { walk } from "https://deno.land/std@0.213.0/fs/walk.ts";
import * as colors from "https://deno.land/std@0.213.0/fmt/colors.ts";

const cache = await caches.open("petitevite");
const getOrFetchAsText = async (url: string) => {
	const cached = await cache.match(url);
	if (cached) {
		return cached.text();
	}
	const response = await fetch(url);
	await cache.put(url, response.clone());
	return await response.text();
};

const rm = (path: string) =>
	Deno
		.remove(join(import.meta.dirname!, path), { recursive: true })
		.catch((_) => {});

const importMap: Map<string, { browser: string; node: string }> = new Map([
	["npm:@sinclair/typebox@0.32.13/type", {
		browser: "https://cdn.skypack.dev/@sinclair/typebox@0.32.13/type",
		node: "@sinclair/typebox/type",
	}],
	["npm:@sinclair/typebox@0.32.13/value", {
		browser: "https://cdn.skypack.dev/@sinclair/typebox@0.32.13/value",
		node: "@sinclair/typebox/value",
	}],
	["npm:@sinclair/typebox@0.32.13/compiler", {
		browser: "https://cdn.skypack.dev/@sinclair/typebox@0.32.13/compiler",
		node: "@sinclair/typebox/compiler",
	}],
	["npm:@sinclair/typebox@0.32.13", {
		browser: "https://cdn.skypack.dev/@sinclair/typebox@0.32.13",
		node: "@sinclair/typebox",
	}],
	["npm:jose@5.2.0", {
		browser: "https://cdn.skypack.dev/jose@5.2.0",
		node: "jose",
	}],
	["npm:openapi-types@12.1.3", {
		browser: "https://cdn.skypack.dev/openapi-types@12.1.3",
		node: "openapi-types",
	}],
]);
const virtualFiles = new Map<string, { content: string; as: string }>([
	["https://deno.land/std@0.213.0/encoding/base32.ts", {
		content: await getOrFetchAsText(
			"https://deno.land/std@0.213.0/encoding/base32.ts",
		),
		as: "./vendor/deno/encoding/base32.ts",
	}],
	["https://deno.land/std@0.213.0/encoding/base64.ts", {
		content: await getOrFetchAsText(
			"https://deno.land/std@0.213.0/encoding/base64.ts",
		),
		as: "./vendor/deno/encoding/base64.ts",
	}],
	["https://deno.land/std@0.213.0/encoding/_util.ts", {
		content: await getOrFetchAsText(
			"https://deno.land/std@0.213.0/encoding/_util.ts",
		),
		as: "./vendor/deno/encoding/_util.ts",
	}],
]);

// await rm("./npm/node");
// await rm("./npm/browser");
// await rm("./npm/types");

const entrypoints = await Array.fromAsync(walk(import.meta.dirname!, {
	match: [globToRegExp("**/*.{ts,tsx}")],
	skip: [
		/build2?\.ts/,
		globToRegExp(join(import.meta.dirname!, "**/*.test.*")),
		globToRegExp(join(import.meta.dirname!, "**/*.bench.*")),
		globToRegExp(
			join(
				import.meta.dirname!,
				"{.deno,coverage,examples,node_modules,npm}/**/*",
			),
		),
		globToRegExp(
			join(
				import.meta.dirname!,
				"providers/{asset-denofs,kv-denokv,document-denokv}/**/*",
			),
		),
	],
}));

const timeStart = performance.now();
console.log(
	`${colors.green(colors.bold(`PetiteVITE`) + ` v0.0.0`)} ${
		colors.blue("building for production...")
	}`,
);

const printer = ts.createPrinter();

{
	await rm("./npm/src");
	await rm("./npm/node");
	await rm("./npm/types");

	for (const entrypoint of entrypoints) {
		const sourceFile = ts.createSourceFile(
			entrypoint.path,
			await Deno.readTextFile(entrypoint.path),
			ts.ScriptTarget.ESNext,
		);

		const transformResult = ts.transform(sourceFile, [
			(context) => {
				const visit: ts.Visitor = (node) => {
					if (
						ts.isImportDeclaration(node) &&
						node.moduleSpecifier &&
						ts.isStringLiteral(node.moduleSpecifier)
					) {
						if (importMap.has(node.moduleSpecifier.text)) {
							const mapTo = importMap.get(node.moduleSpecifier.text)!;
							node.moduleSpecifier.text = mapTo.node;
						} else if (virtualFiles.has(node.moduleSpecifier.text)) {
							node.moduleSpecifier.text =
								virtualFiles.get(node.moduleSpecifier.text)!.as;
						} else if (node.moduleSpecifier.text.match(/^(https?:\/\/|npm:)/)) {
							console.error(
								colors.red(`×`) +
									colors.dim(
										` ${node.moduleSpecifier.text} not found in importMap.`,
									),
							);
						}
						return context.factory.createImportDeclaration(
							node.modifiers,
							node.importClause,
							context.factory.createStringLiteral(node.moduleSpecifier.text),
							node.assertClause,
						);
					} else if (
						ts.isExportDeclaration(node) &&
						node.moduleSpecifier &&
						ts.isStringLiteral(node.moduleSpecifier)
					) {
						if (importMap.has(node.moduleSpecifier.text)) {
							const mapTo = importMap.get(node.moduleSpecifier.text)!;
							node.moduleSpecifier.text = mapTo.node;
						} else if (virtualFiles.has(node.moduleSpecifier.text)) {
							node.moduleSpecifier.text =
								virtualFiles.get(node.moduleSpecifier.text)!.as;
						} else if (node.moduleSpecifier.text.match(/^(https?:\/\/|npm:)/)) {
							console.error(
								colors.red(`×`) +
									colors.dim(
										` ${node.moduleSpecifier.text} not found in importMap.`,
									),
							);
						}
						return context.factory.createExportDeclaration(
							node.modifiers,
							node.isTypeOnly,
							node.exportClause,
							context.factory.createStringLiteral(node.moduleSpecifier.text),
							node.assertClause,
						);
					}
					return ts.visitEachChild(node, (child) => visit(child), context);
				};
				return (node) => ts.visitNode(node, visit) as any;
			},
		]);

		const dest = join(
			import.meta.dirname!,
			"npm/src",
			"./" + relative(import.meta.dirname!, entrypoint.path),
		);
		const code = printer.printFile(transformResult.transformed[0]);

		await Deno.mkdir(dirname(dest), { recursive: true });
		await Deno.writeTextFile(dest, code);
	}

	for (const virtual of virtualFiles) {
		const dest = join(import.meta.dirname!, "npm/src", virtual[1].as);
		await Deno.mkdir(dirname(dest), { recursive: true });
		await Deno.writeTextFile(dest, virtual[1].content);
	}

	await Deno.writeTextFile(
		join(import.meta.dirname!, "npm/package.json"),
		JSON.stringify(
			{
				name: "@baseless/core",
				version: "0.0.0",
				description: "Baseless Core",
				repository: {
					type: "git",
					url: "git+https://github.com/baseless-dev/core",
				},
				type: "module",
				dependencies: {
					"@sinclair/typebox": "0.32.13",
					jose: "5.2.0",
				},
				devDependencies: {
					"@cloudflare/workers-types": "4.20230914.0",
					"openapi-types": "12.1.3",
					"typescript": "5.3.3",
				},
			},
			undefined,
			"  ",
		),
	);

	await Deno.writeTextFile(
		join(import.meta.dirname!, "npm/tsconfig.json"),
		JSON.stringify(
			{
				include: ["src/**/*"],
				exclude: ["node_modules", "**/*.test.*", "**/*.bench.*"],
				compilerOptions: {
					target: "ESNext",
					module: "NodeNext",
					moduleResolution: "NodeNext",
					lib: ["esnext", "dom", "webworker"],
					types: ["@cloudflare/workers-types"],
				},
			},
			undefined,
			"  ",
		),
	);

	const npmInstall = new Deno.Command(`npm`, { cwd: "./npm", args: ["i"] })
		.spawn();
	await npmInstall.status;

	const typeCompile = new Deno.Command(`npx`, {
		cwd: "./npm",
		args: [
			"tsc",
			"--project",
			"tsconfig.json",
			"--emitDeclarationOnly",
			"--declaration",
			"--outDir",
			"types",
		],
	}).spawn();
	await typeCompile.status;

	const nodeCompile = new Deno.Command(`npx`, {
		cwd: "./npm",
		args: [
			"tsc",
			"--project",
			"tsconfig.json",
			"--outDir",
			"node",
		],
	}).spawn();
	await nodeCompile.status;

	await rm("./npm/package.json");
	await rm("./npm/package-lock.json");
	await rm("./npm/tsconfig.json");
	await rm("./npm/src");
}
{
	await rm("./npm/src");
	await rm("./npm/browser");

	for (const entrypoint of entrypoints) {
		const sourceFile = ts.createSourceFile(
			entrypoint.path,
			await Deno.readTextFile(entrypoint.path),
			ts.ScriptTarget.ESNext,
		);

		const transformResult = ts.transform(sourceFile, [
			(context) => {
				const visit: ts.Visitor = (node) => {
					if (
						ts.isImportDeclaration(node) &&
						node.moduleSpecifier &&
						ts.isStringLiteral(node.moduleSpecifier)
					) {
						if (importMap.has(node.moduleSpecifier.text)) {
							const mapTo = importMap.get(node.moduleSpecifier.text)!;
							node.moduleSpecifier.text = mapTo.browser;
						} else if (virtualFiles.has(node.moduleSpecifier.text)) {
							node.moduleSpecifier.text =
								virtualFiles.get(node.moduleSpecifier.text)!.as;
						} else if (node.moduleSpecifier.text.match(/^(https?:\/\/|npm:)/)) {
							console.error(
								colors.red(`×`) +
									colors.dim(
										` ${node.moduleSpecifier.text} not found in importMap.`,
									),
							);
						}
						return context.factory.createImportDeclaration(
							node.modifiers,
							node.importClause,
							context.factory.createStringLiteral(node.moduleSpecifier.text),
							node.assertClause,
						);
					} else if (
						ts.isExportDeclaration(node) &&
						node.moduleSpecifier &&
						ts.isStringLiteral(node.moduleSpecifier)
					) {
						if (importMap.has(node.moduleSpecifier.text)) {
							const mapTo = importMap.get(node.moduleSpecifier.text)!;
							node.moduleSpecifier.text = mapTo.browser;
						} else if (virtualFiles.has(node.moduleSpecifier.text)) {
							node.moduleSpecifier.text =
								virtualFiles.get(node.moduleSpecifier.text)!.as;
						} else if (node.moduleSpecifier.text.match(/^(https?:\/\/|npm:)/)) {
							console.error(
								colors.red(`×`) +
									colors.dim(
										` ${node.moduleSpecifier.text} not found in importMap.`,
									),
							);
						}
						return context.factory.createExportDeclaration(
							node.modifiers,
							node.isTypeOnly,
							node.exportClause,
							context.factory.createStringLiteral(node.moduleSpecifier.text),
							node.assertClause,
						);
					}
					return ts.visitEachChild(node, (child) => visit(child), context);
				};
				return (node) => ts.visitNode(node, visit) as any;
			},
		]);

		const dest = join(
			import.meta.dirname!,
			"npm/src",
			"./" + relative(import.meta.dirname!, entrypoint.path),
		);
		const code = printer.printFile(transformResult.transformed[0]);

		await Deno.mkdir(dirname(dest), { recursive: true });
		await Deno.writeTextFile(dest, code);
	}

	for (const [, { as, content }] of virtualFiles) {
		const dest = join(import.meta.dirname!, "npm/src", as);
		await Deno.mkdir(dirname(dest), { recursive: true });
		await Deno.writeTextFile(dest, content);
	}

	const fileNames = await Array.fromAsync(
		walk(join(import.meta.dirname!, "npm/src")),
	);

	const program = ts.createProgram(fileNames.map((e) => e.path), {
		lib: ["esnext", "dom", "webworker"],
		module: ts.ModuleKind.ESNext,
		target: ts.ScriptTarget.ESNext,
		outDir: join(import.meta.dirname!, "npm/browser"),
	});
	program.emit();

	await rm("./npm/src");
}

await Deno.writeTextFile(
	join(import.meta.dirname!, "npm/package.json"),
	JSON.stringify(
		{
			name: "@baseless/core",
			version: "0.0.0",
			description: "Baseless Core",
			repository: {
				type: "git",
				url: "git+https://github.com/baseless-dev/core",
			},
			type: "module",
			dependencies: {
				"@sinclair/typebox": "0.32.13",
				jose: "5.2.0",
			},
			devDependencies: {
				"@cloudflare/workers-types": "4.20230914.0",
				"openapi-types": "12.1.3",
			},
			exports: Object.fromEntries(
				entrypoints.map(
					(entry) => {
						const key = "./" + relative(import.meta.dirname!, entry.path);
						return [key.replace(/\.tsx?$/, "").replace(/\/mod$/, ""), {
							types: "./" + join("types/", key.replace(/\.tsx?$/, ".d.ts")),
							import: "./" + join("node/", key.replace(/\.tsx?$/, ".js")),
							browser: "./" + join("browser/", key.replace(/\.tsx?$/, ".js")),
						}];
					},
				),
			),
		},
		undefined,
		"  ",
	),
);

const npmInstall = new Deno.Command(`npm`, { cwd: "./npm", args: ["i"] })
	.spawn();
await npmInstall.status;

const npmLink = new Deno.Command(`npm`, { cwd: "./npm", args: ["link"] })
	.spawn();
await npmLink.status;

console.log(
	colors.green("✓") +
		colors.dim(
			` ${entrypoints.length} modules transformed in ${
				(performance.now() - timeStart).toFixed(0)
			}ms.`,
		),
);

Deno.exit(0);
