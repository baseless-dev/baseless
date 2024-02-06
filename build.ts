import {
	dirname,
	fromFileUrl,
	globToRegExp,
	join,
	relative,
} from "https://deno.land/std@0.213.0/path/mod.ts";
import { walk } from "https://deno.land/std@0.213.0/fs/walk.ts";
import * as colors from "https://deno.land/std@0.213.0/fmt/colors.ts";
import {
	ModuleKind,
	Project,
	ScriptTarget,
	ts,
} from "https://deno.land/x/ts_morph@21.0.1/mod.ts";

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
]);

await Deno
	.remove(join(import.meta.dirname!, "./npm"), { recursive: true })
	.catch((_) => {});

const entrypoints = await Array.fromAsync(walk(import.meta.dirname!, {
	match: [globToRegExp("**/*.{ts,tsx}")],
	skip: [
		/build\.ts/,
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

const browserProject = new Project({
	compilerOptions: {
		outDir: join(import.meta.dirname!, "npm/browser"),
		declaration: false,
		sourceMap: true,
		target: ScriptTarget.ESNext,
		module: ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
	},
});
// const nodeProject = new Project({
// 	compilerOptions: {
// 		outDir: join(import.meta.dirname!, "npm/node"),
// 		declaration: false,
// 		sourceMap: true,
// 		target: ScriptTarget.ESNext,
// 		module: ModuleKind.ESNext,
// 		moduleResolution: ts.ModuleResolutionKind.NodeNext,
// 	},
// });
const typesProject = new Project({
	compilerOptions: {
		outDir: join(import.meta.dirname!, "npm/types"),
		declaration: true,
		emitDeclarationOnly: true,
		target: ScriptTarget.ESNext,
		module: ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
	},
});

for (const entrypoint of entrypoints) {
	browserProject.addSourceFileAtPath(entrypoint.path);
	// nodeProject.addSourceFileAtPath(entrypoint.path);
	typesProject.addSourceFileAtPath(entrypoint.path);
}
for (const { as, content } of virtualFiles.values()) {
	browserProject.createSourceFile(as, content);
	// nodeProject.createSourceFile(as, content);
	typesProject.createSourceFile(as, content);
}

const browserResult = await browserProject.emitToMemory({
	customTransformers: {
		before: [
			(context) => (sourceFile) =>
				visitSourceFile(
					sourceFile,
					context,
					visitImportExportDeclaration((node, moduleSpecifier) => {
						if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) {
							return context.factory.createNotEmittedStatement(node);
						}
						if (importMap.has(moduleSpecifier)) {
							const mapTo = importMap.get(moduleSpecifier)!;
							moduleSpecifier = mapTo.browser;
						} else if (virtualFiles.has(moduleSpecifier)) {
							moduleSpecifier = virtualFiles.get(moduleSpecifier)!.as;
						} else if (moduleSpecifier.match(/^(https?:\/\/|npm:)/)) {
							console.error(
								colors.red(`×`) +
									colors.dim(` ${moduleSpecifier} not found in importMap.`),
							);
						}
						moduleSpecifier = moduleSpecifier.replace(/\.tsx?$/, ".mjs");
						if (ts.isImportDeclaration(node)) {
							let namedBindings = node.importClause?.namedBindings;
							if (namedBindings && ts.isNamedImports(namedBindings)) {
								const elements = namedBindings.elements.filter((e) =>
									!e.isTypeOnly
								);
								if (elements.length === 0) {
									return undefined;
								}
								namedBindings = context.factory.createNamedImports(
									elements,
								);
							}
							const importClause = context.factory.createImportClause(
								false,
								node.importClause?.name,
								namedBindings,
							);
							return context.factory.createImportDeclaration(
								node.modifiers,
								importClause,
								context.factory.createStringLiteral(moduleSpecifier),
								node.assertClause,
							);
						} else {
							if (node.isTypeOnly) {
								return undefined;
							}
							let exportClause = node.exportClause;
							if (exportClause && ts.isNamedExports(exportClause)) {
								const elements = exportClause.elements.filter((e) =>
									!e.isTypeOnly
								);
								if (elements.length === 0) {
									return undefined;
								}
								exportClause = context.factory.createNamedExports(
									elements,
								);
							}
							return context.factory.createExportDeclaration(
								node.modifiers,
								node.isTypeOnly,
								exportClause,
								context.factory.createStringLiteral(moduleSpecifier),
								node.assertClause,
							);
						}
					}),
				),
		],
	},
});
const browserDiagnostics = browserResult.getDiagnostics();

// const nodeResult = await nodeProject.emitToMemory({
// 	customTransformers: {
// 		before: [
// 			(context) => (sourceFile) =>
// 				visitSourceFile(
// 					sourceFile,
// 					context,
// 					visitImportExportDeclaration((node, moduleSpecifier) => {
// 						if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) {
// 							return context.factory.createNotEmittedStatement(node);
// 						}
// 						if (importMap.has(moduleSpecifier)) {
// 							const mapTo = importMap.get(moduleSpecifier)!;
// 							if ("bundle" in mapTo) {
// 								console.log(`Node bundling ${moduleSpecifier}...`);
// 							} else {
// 								moduleSpecifier = mapTo.node;
// 							}
// 						} else {
// 							moduleSpecifier = moduleSpecifier.replace(/\.tsx?$/, ".mjs");
// 						}
// 						if (ts.isImportDeclaration(node)) {
// 							let namedBindings = node.importClause?.namedBindings;
// 							if (namedBindings && ts.isNamedImports(namedBindings)) {
// 								namedBindings = context.factory.createNamedImports(
// 									namedBindings.elements.filter((e) => !e.isTypeOnly),
// 								);
// 							}
// 							const importClause = context.factory.createImportClause(
// 								false,
// 								node.importClause?.name,
// 								namedBindings,
// 							);
// 							return context.factory.createImportDeclaration(
// 								node.modifiers,
// 								importClause,
// 								context.factory.createStringLiteral(
// 									moduleSpecifier.replace(/\.tsx?$/, ""),
// 								),
// 								node.assertClause,
// 							);
// 						} else {
// 							return context.factory.createExportDeclaration(
// 								node.modifiers,
// 								node.isTypeOnly,
// 								node.exportClause,
// 								context.factory.createStringLiteral(
// 									moduleSpecifier.replace(/\.tsx?$/, ""),
// 								),
// 								node.assertClause,
// 							);
// 						}
// 					}),
// 				),
// 		],
// 	},
// });
// const nodeDiagnostics = nodeResult.getDiagnostics();

const typesResult = await typesProject.emitToMemory({
	emitOnlyDtsFiles: true,
	customTransformers: {
		before: [
			(context) => (sourceFile) =>
				visitSourceFile(
					sourceFile,
					context,
					visitImportExportDeclaration((node, moduleSpecifier) => {
						if (importMap.has(moduleSpecifier)) {
							const mapTo = importMap.get(moduleSpecifier)!;
							moduleSpecifier = mapTo.browser;
						} else if (virtualFiles.has(moduleSpecifier)) {
							moduleSpecifier = virtualFiles.get(moduleSpecifier)!.as;
						} else if (moduleSpecifier.match(/^(https?:\/\/|npm:)/)) {
							console.error(
								colors.red(`×`) +
									colors.dim(` ${moduleSpecifier} not found in importMap.`),
							);
						}
						moduleSpecifier = moduleSpecifier.replace(/\.tsx?$/, ".mjs");
						if (ts.isImportDeclaration(node)) {
							return context.factory.createImportDeclaration(
								node.modifiers,
								node.importClause,
								context.factory.createStringLiteral(moduleSpecifier),
								node.assertClause,
							);
						} else {
							return context.factory.createExportDeclaration(
								node.modifiers,
								node.isTypeOnly,
								node.exportClause,
								context.factory.createStringLiteral(moduleSpecifier),
								node.assertClause,
							);
						}
					}),
				),
		],
	},
});
const typesDiagnostics = typesResult.getDiagnostics();

const diagnostics = [
	...browserDiagnostics,
	// 	...nodeDiagnostics,
	...typesDiagnostics,
];
if (diagnostics.length) {
	console.log(
		colors.red("×") +
			colors.dim(
				` Error while transforming project.`,
			),
	);
	for (const diagnostic of diagnostics) {
		console.log(diagnostic.getMessageText());
	}
	Deno.exit(0);
}

for (const file of browserResult.getFiles()) {
	const filePath = file.filePath.replace(/\.js(\.map)?$/, ".mjs$1");
	const fileText = file.text.replace(
		/(\/\/# sourceMappingURL=.*).js.map/g,
		"$1.mjs.map",
	);
	// TODO replace .js to .mjs in { files } from .mjs.map
	await Deno.mkdir(dirname(filePath), { recursive: true });
	await Deno.writeTextFile(filePath, fileText);
}
// for (const file of nodeResult.getFiles()) {
// 	const filePath = file.filePath.replace(/\.js(\.map)?$/, ".mjs$1");
// 	const fileText = file.text.replace(
// 		/(\/\/# sourceMappingURL=.*).js.map/g,
// 		"$1.mjs.map",
// 	);
// 	// TODO replace .js to .mjs in { files } from .mjs.map
// 	await Deno.mkdir(dirname(filePath), { recursive: true });
// 	await Deno.writeTextFile(filePath, fileText);
// }
for (const file of typesResult.getFiles()) {
	await Deno.mkdir(dirname(file.filePath), { recursive: true });
	// Poor's man replace importMap in types file
	for (const [src, { node }] of importMap) {
		file.text = file.text.replaceAll(src, node);
	}
	for (const [src, { as }] of virtualFiles) {
		file.text = file.text.replaceAll(src, as.replace(/\.tsx?$/, ""));
	}
	await Deno.writeTextFile(file.filePath, file.text);
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
							// node: "./" + join("node/", key.replace(/\.tsx?$/, ".mjs")),
							// browser: "./" + join("node/", key.replace(/\.tsx?$/, ".mjs")),
							browser: "./" + join("browser/", key.replace(/\.tsx?$/, ".mjs")),
							// deno: "./" + join("deno/", key),
							types: "./" + join("types/", key.replace(/\.tsx?$/, ".d.ts")),
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

function visitImportExportDeclaration(
	visitNode: (
		node: ts.ImportDeclaration | ts.ExportDeclaration,
		moduleSpecifier: string,
	) => ts.Node | undefined,
): (node: ts.Node, context: ts.TransformationContext) => ts.Node | undefined {
	return (node: ts.Node, _context: ts.TransformationContext) => {
		if (
			ts.isImportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			return visitNode(node, node.moduleSpecifier.text);
		}
		if (
			ts.isExportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			return visitNode(node, node.moduleSpecifier.text);
		}
		return node;
	};
}

function visitSourceFile(
	sourceFile: ts.SourceFile,
	context: ts.TransformationContext,
	visitNode: (
		node: ts.Node,
		context: ts.TransformationContext,
	) => ts.Node | undefined,
): ts.SourceFile {
	return visitNodeAndChildren(sourceFile) as ts.SourceFile;

	function visitNodeAndChildren(node: ts.Node): ts.Node | undefined {
		return ts.visitEachChild(
			visitNode(node, context),
			visitNodeAndChildren,
			context,
		);
	}
}
