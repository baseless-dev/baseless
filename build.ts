// deno-lint-ignore-file no-explicit-any
import ts from "npm:typescript";
import {
	dirname,
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
	Deno.remove(path, { recursive: true }).catch((_) => {});
const mkdir = (path: string) => Deno.mkdir(path, { recursive: true });
const writeText = (path: string, content: string) =>
	Deno.writeTextFile(path, content);

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
				"providers/*/deno-*/**/*",
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

console.log(
	colors.dim(
		`• Exporting ${entrypoints.length + virtualFiles.size} modules`,
	),
);

const printer = ts.createPrinter();

await mkdir(join(import.meta.dirname!, "./npm"));

{
	await rm(join(import.meta.dirname!, "./npm/src"));

	await writeText(
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

	await writeText(
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

	const npmInstall = new Deno.Command(`npm`, {
		cwd: "./npm",
		args: ["i"],
		stdout: "null",
		stderr: "null",
	})
		.spawn();
	await npmInstall.status;

	await rm(join(import.meta.dirname!, "./npm/types"));

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
							const as = relative(
								dirname(entrypoint.path),
								join(
									import.meta.dirname!,
									virtualFiles.get(node.moduleSpecifier.text)!.as,
								),
							);
							node.moduleSpecifier.text = as;
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
							const as = relative(
								dirname(entrypoint.path),
								join(
									import.meta.dirname!,
									virtualFiles.get(node.moduleSpecifier.text)!.as,
								),
							);
							node.moduleSpecifier.text = as;
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

		await mkdir(dirname(dest));
		await writeText(dest, code);
	}

	for (const [, { as, content }] of virtualFiles) {
		const dest = join(import.meta.dirname!, "npm/src", as);
		await mkdir(dirname(dest));
		await writeText(dest, content);
	}

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
		stdout: "null",
		stderr: "null",
	}).spawn();
	await typeCompile.status;

	console.log(colors.dim(`• Types definition`));

	await rm(join(import.meta.dirname!, "./npm/src"));
	await rm(join(import.meta.dirname!, "./npm/node"));

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
							const as = relative(
								dirname(entrypoint.path),
								join(
									import.meta.dirname!,
									virtualFiles.get(node.moduleSpecifier.text)!.as,
								),
							);
							node.moduleSpecifier.text = as;
						} else if (node.moduleSpecifier.text.match(/^(https?:\/\/|npm:)/)) {
							console.error(
								colors.red(`×`) +
									colors.dim(
										` ${node.moduleSpecifier.text} not found in importMap.`,
									),
							);
						}
						node.moduleSpecifier.text = node.moduleSpecifier.text.replace(
							/\.tsx?$/,
							"",
						);
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
							const as = relative(
								dirname(entrypoint.path),
								join(
									import.meta.dirname!,
									virtualFiles.get(node.moduleSpecifier.text)!.as,
								),
							);
							node.moduleSpecifier.text = as;
						} else if (node.moduleSpecifier.text.match(/^(https?:\/\/|npm:)/)) {
							console.error(
								colors.red(`×`) +
									colors.dim(
										` ${node.moduleSpecifier.text} not found in importMap.`,
									),
							);
						}
						node.moduleSpecifier.text = node.moduleSpecifier.text.replace(
							/\.tsx?$/,
							"",
						);
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

		await mkdir(dirname(dest));
		await writeText(dest, code);
	}

	for (const [, { as, content }] of virtualFiles) {
		const dest = join(import.meta.dirname!, "npm/src", as);
		await mkdir(dirname(dest));
		await writeText(
			dest,
			content.replace(/\.(jsx?|tsx?)("|')/g, "$2"),
		);
	}

	const nodeCompile = new Deno.Command(`npx`, {
		cwd: "./npm",
		args: [
			"tsc",
			"--project",
			"tsconfig.json",
			"--outDir",
			"node",
		],
		stdout: "null",
		stderr: "null",
	}).spawn();
	await nodeCompile.status;

	console.log(colors.dim(`• Nodejs`));

	await rm(join(import.meta.dirname!, "./npm/package.json"));
	await rm(join(import.meta.dirname!, "./npm/package-lock.json"));
	await rm(join(import.meta.dirname!, "./npm/tsconfig.json"));
	await rm(join(import.meta.dirname!, "./npm/src"));
}
{
	await rm(join(import.meta.dirname!, "./npm/src"));
	await rm(join(import.meta.dirname!, "./npm/browser"));

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
							const as = relative(
								dirname(entrypoint.path),
								join(
									import.meta.dirname!,
									virtualFiles.get(node.moduleSpecifier.text)!.as,
								),
							);
							node.moduleSpecifier.text = as;
						} else if (node.moduleSpecifier.text.match(/^(https?:\/\/|npm:)/)) {
							console.error(
								colors.red(`×`) +
									colors.dim(
										` ${node.moduleSpecifier.text} not found in importMap.`,
									),
							);
						}
						node.moduleSpecifier.text = node.moduleSpecifier.text.replace(
							/\.tsx?$/,
							".js",
						);
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
							const as = relative(
								dirname(entrypoint.path),
								join(
									import.meta.dirname!,
									virtualFiles.get(node.moduleSpecifier.text)!.as,
								),
							);
							node.moduleSpecifier.text = as;
						} else if (node.moduleSpecifier.text.match(/^(https?:\/\/|npm:)/)) {
							console.error(
								colors.red(`×`) +
									colors.dim(
										` ${node.moduleSpecifier.text} not found in importMap.`,
									),
							);
						}
						node.moduleSpecifier.text = node.moduleSpecifier.text.replace(
							/\.tsx?$/,
							".js",
						);
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

		await mkdir(dirname(dest));
		await writeText(dest, code);
	}

	for (const [, { as, content }] of virtualFiles) {
		const dest = join(import.meta.dirname!, "npm/src", as);
		await mkdir(dirname(dest));
		await writeText(
			dest,
			content.replace(/\.(jsx?|tsx?)("|')/g, ".js$2"),
		);
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

	console.log(colors.dim(`• Browser`));

	await rm(join(import.meta.dirname!, "./npm/src"));
}

await writeText(
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

const npmInstall = new Deno.Command(`npm`, {
	cwd: "./npm",
	args: ["i"],
	stdout: "null",
	stderr: "null",
})
	.spawn();
await npmInstall.status;

const npmLink = new Deno.Command(`npm`, {
	cwd: "./npm",
	args: ["link"],
	stdout: "null",
	stderr: "null",
})
	.spawn();
await npmLink.status;

console.log(
	colors.green("✓") +
		colors.dim(
			` Build took ${(performance.now() - timeStart).toFixed(0)}ms.`,
		),
);

Deno.exit(0);
