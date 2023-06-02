import {
	dirname,
	fromFileUrl,
	globToRegExp,
	join,
	relative,
} from "https://deno.land/std@0.179.0/path/mod.ts";
import { walk } from "https://deno.land/std@0.179.0/fs/walk.ts";
import * as colors from "https://deno.land/std@0.165.0/fmt/colors.ts";
import {
	ModuleKind,
	Project,
	ScriptTarget,
	ts,
} from "https://deno.land/x/ts_morph@18.0.0/mod.ts";

const __dirname = fromFileUrl(new URL(".", import.meta.url));

const importMap: Map<string, { browser: string; node: string }> = new Map([
	["https://deno.land/x/jose@v4.13.1/jwt/verify.ts", {
		browser: "https://cdnjs.cloudflare.com/ajax/libs/jose/4.13.1/jwt/verify.js",
		node: "jose",
	}],
	["https://deno.land/x/jose@v4.13.1/jwt/sign.ts", {
		browser: "https://cdnjs.cloudflare.com/ajax/libs/jose/4.13.1/jwt/sign.js",
		node: "jose",
	}],
	["https://deno.land/x/jose@v4.13.1/runtime/generate.ts", {
		browser:
			"https://cdnjs.cloudflare.com/ajax/libs/jose/4.13.1/runtime/generate.js",
		node: "jose",
	}],
	["https://deno.land/x/jose@v4.13.1/types.d.ts", {
		browser: "https://deno.land/x/jose@v4.13.1/types.d.ts",
		node: "jose",
	}],
]);

await Deno.remove(join(__dirname, "./npm"), { recursive: true }).catch(
	(_) => {},
);

const entryPoints = new Array<string>();
for await (
	const entry of walk(__dirname, {
		match: [globToRegExp("**/*.{ts,tsx}")],
		skip: [
			globToRegExp(join(__dirname, "**/*.test.*")),
			globToRegExp(
				join(
					__dirname,
					"{.deno,coverage,examples,node_modules,npm}/**/*",
				),
			),
			globToRegExp(
				join(
					__dirname,
					"providers/{asset-local}/**/*",
				),
			),
			/build\.ts/,
		],
	})
) {
	entryPoints.push(entry.path);
}

const timeStart = performance.now();
console.log(
	`${colors.green(colors.bold(`PetiteVITE`) + ` v0.0.0`)} ${
		colors.blue("building for production...")
	}`,
);

const browserProject = new Project({
	compilerOptions: {
		outDir: join(__dirname, "npm/browser"),
		declaration: false,
		sourceMap: true,
		target: ScriptTarget.ESNext,
		module: ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
	},
});
const nodeProject = new Project({
	compilerOptions: {
		outDir: join(__dirname, "npm/node/esm"),
		declaration: false,
		sourceMap: true,
		target: ScriptTarget.ESNext,
		module: ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
	},
});
const typesProject = new Project({
	compilerOptions: {
		outDir: join(__dirname, "npm/types"),
		declaration: true,
		emitDeclarationOnly: true,
		target: ScriptTarget.ESNext,
		module: ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext,
	},
});

for await (const entryPoint of entryPoints) {
	browserProject.addSourceFileAtPath(entryPoint);
	nodeProject.addSourceFileAtPath(entryPoint);
	typesProject.addSourceFileAtPath(entryPoint);
	const outputPath = join(
		__dirname,
		"npm/deno/",
		relative(__dirname, entryPoint),
	);
	await Deno.mkdir(dirname(outputPath), { recursive: true });
	await Deno.copyFile(entryPoint, outputPath);
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
							if ("bundle" in mapTo) {
								console.log(`Browser bundling ${moduleSpecifier}...`);
							} else {
								moduleSpecifier = mapTo.browser;
							}
						} else {
							moduleSpecifier = moduleSpecifier.replace(/\.tsx?$/, ".mjs");
						}
						if (ts.isImportDeclaration(node)) {
							let namedBindings = node.importClause?.namedBindings;
							if (namedBindings && ts.isNamedImports(namedBindings)) {
								namedBindings = context.factory.createNamedImports(
									namedBindings.elements.filter((e) => !e.isTypeOnly),
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
const browserDiagnostics = browserResult.getDiagnostics();

const nodeResult = await nodeProject.emitToMemory({
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
							if ("bundle" in mapTo) {
								console.log(`Node bundling ${moduleSpecifier}...`);
							} else {
								moduleSpecifier = mapTo.node;
							}
						} else {
							moduleSpecifier = moduleSpecifier.replace(/\.tsx?$/, ".mjs");
						}
						if (ts.isImportDeclaration(node)) {
							let namedBindings = node.importClause?.namedBindings;
							if (namedBindings && ts.isNamedImports(namedBindings)) {
								namedBindings = context.factory.createNamedImports(
									namedBindings.elements.filter((e) => !e.isTypeOnly),
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
								context.factory.createStringLiteral(
									moduleSpecifier.replace(/\.tsx?$/, ""),
								),
								node.assertClause,
							);
						} else {
							return context.factory.createExportDeclaration(
								node.modifiers,
								node.isTypeOnly,
								node.exportClause,
								context.factory.createStringLiteral(
									moduleSpecifier.replace(/\.tsx?$/, ""),
								),
								node.assertClause,
							);
						}
					}),
				),
		],
	},
});
const nodeDiagnostics = nodeResult.getDiagnostics();

const typesResult = await typesProject.emitToMemory({ emitOnlyDtsFiles: true });
const typesDiagnostics = typesResult.getDiagnostics();

const diagnostics = [
	...browserDiagnostics,
	...nodeDiagnostics,
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
	// TODO replace .js to .mjs in { files } from .mjs.map
	await Deno.mkdir(dirname(filePath), { recursive: true });
	await Deno.writeTextFile(filePath, file.text);
}
for (const file of nodeResult.getFiles()) {
	const filePath = file.filePath.replace(/\.js(\.map)?$/, ".mjs$1");
	// TODO replace .js to .mjs in { files } from .mjs.map
	await Deno.mkdir(dirname(filePath), { recursive: true });
	await Deno.writeTextFile(filePath, file.text);
}
for (const file of typesResult.getFiles()) {
	await Deno.mkdir(dirname(file.filePath), { recursive: true });
	await Deno.writeTextFile(file.filePath, file.text);
}

await Deno.writeTextFile(
	join(__dirname, "npm/package.json"),
	JSON.stringify(
		{
			name: "@baseless/core",
			version: "0.0.0",
			description: "Baseless Core",
			repository: {
				type: "git",
				url: "git+https://github.com/baseless-dev/baseless",
			},
			type: "module",
			dependencies: {
				jose: "4.13.1",
			},
			// devDependencies: {
			// 	"@typescript-eslint/eslint-plugin": "^5.59.7",
			// 	"@typescript-eslint/parser": "^5.59.7",
			// 	"eslint": "^8.41.0",
			// 	"eslint-plugin-jsdoc": "^44.2.4",
			// 	"typescript": "^5.0.4",
			// },
			exports: Object.fromEntries(
				entryPoints.map(
					(entryPath) => {
						const key = "./" + relative(__dirname, entryPath);
						return [key.replace(/\.tsx?$/, "").replace(/\/mod$/, ""), {
							node: "./" + join("node/esm/", key.replace(/\.tsx?$/, ".mjs")),
							browser: "./" + join("browser/", key.replace(/\.tsx?$/, ".mjs")),
							deno: "./" + join("deno/", key),
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
			` ${entryPoints.length} modules transformed in ${
				(performance.now() - timeStart).toFixed(0)
			}ms.`,
		),
);

// await Deno.writeTextFile(
// 	join(__dirname, "npm/.eslintrc.json"),
// 	JSON.stringify({
// 		"root": true,
// 		"parser": "@typescript-eslint/parser",
// 		"parserOptions": {
// 			"project": true,
// 			"createDefaultProgram": true
// 		},
// 		"plugins": [
// 			"jsdoc",
// 			"@typescript-eslint"
// 		],
// 		"extends": [
// 			"plugin:@typescript-eslint/recommended"
// 		],
// 		"rules": {
// 			"@typescript-eslint/no-unused-vars": [
// 				"error",
// 				{
// 					"argsIgnorePattern": "^_"
// 				}
// 			],
// 			"jsdoc/no-undefined-types": 1,
// 			"@typescript-eslint/consistent-type-imports": [
// 				"error",
// 				{
// 					"prefer": "type-imports",
// 					"fixStyle": "inline-type-imports"
// 				}
// 			],
// 			"@typescript-eslint/consistent-type-exports": [
// 				"error"
// 			]
// 		}
// 	},
// 		undefined,
// 		"  ",
// 	)
// );
// await Deno.writeTextFile(
// 	join(__dirname, "npm/tsconfig.json"),
// 	JSON.stringify({
// 		"compilerOptions": {
// 			"lib": [
// 				"esnext",
// 				"dom",
// 				"dom.iterable"
// 			]
// 		},
// 	},
// 		undefined,
// 		"  ",)
// );
// await Deno.writeTextFile(
// 	join(__dirname, "npm/.eslintignore"),
// 	`**/*.{d.ts,ts,mjs.map}`
// );
// await Deno.writeTextFile(
// 	join(__dirname, "npm/.npmignore"),
// 	`tsconfig.json\n.eslintrc.json\n.eslintignore#`
// );

// const eslint = new Deno.Command(`npx`, { cwd: "./npm", args: ["eslint", "."] }).spawn();
// await eslint.status;

Deno.exit(0);

function visitImportExportDeclaration(
	visitNode: (
		node: ts.ImportDeclaration | ts.ExportDeclaration,
		moduleSpecifier: string,
	) => ts.Node,
): (node: ts.Node, context: ts.TransformationContext) => ts.Node {
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
	visitNode: (node: ts.Node, context: ts.TransformationContext) => ts.Node,
): ts.SourceFile {
	return visitNodeAndChildren(sourceFile) as ts.SourceFile;

	function visitNodeAndChildren(node: ts.Node): ts.Node {
		return ts.visitEachChild(
			visitNode(node, context),
			visitNodeAndChildren,
			context,
		);
	}
}
