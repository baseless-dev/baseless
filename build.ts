import {
	fromFileUrl,
	globToRegExp,
	join,
	relative,
} from "https://deno.land/std@0.179.0/path/mod.ts";
import { walk } from "https://deno.land/std@0.179.0/fs/walk.ts";
import * as colors from "https://deno.land/std@0.165.0/fmt/colors.ts";
import { emit } from "https://deno.land/x/emit@0.6.0/mod.ts";
import { ModuleKind, Project, ScriptTarget, Node, ts } from "https://deno.land/x/ts_morph@18.0.0/mod.ts";
import { decode } from "https://deno.land/std@0.179.0/encoding/base64.ts";
import { basename, dirname, extname } from "https://deno.land/std@0.179.0/path/win32.ts";

const __dirname = fromFileUrl(new URL(".", import.meta.url));

await Deno.remove(join(__dirname, "./npm"), { recursive: true }).catch(
	(_) => { },
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
					"{.deno,auth,cli,coverage,examples,npm}/**/*",
				),
			),
			globToRegExp(
				join(
					__dirname,
					"providers/{message-sendgrid,asset-local}/**/*",
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
	`${colors.green(colors.bold(`PetiteVITE`) + ` v0.0.0`)} ${colors.blue("building for production...")
	}`,
);

const browserProject = new Project({
	compilerOptions: {
		outDir: join(__dirname, "npm"),
		declaration: false,
		sourceMap: true,
		target: ScriptTarget.ESNext,
		module: ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext
	},
});
const nodeProject = new Project({
	compilerOptions: {
		outDir: join(__dirname, "npm"),
		declaration: true,
		sourceMap: true,
		target: ScriptTarget.ESNext,
		module: ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.NodeNext
	},
});

for await (const entryPoint of entryPoints) {
	browserProject.addSourceFileAtPath(entryPoint);
	nodeProject.addSourceFileAtPath(entryPoint);
	const outputPath = join(__dirname, "npm/", relative(__dirname, entryPoint));
	await Deno.mkdir(dirname(outputPath), { recursive: true });
	await Deno.copyFile(entryPoint, outputPath);
}

const browserResult = await browserProject.emitToMemory({
	customTransformers: {
		before: [
			context => sourceFile => visitSourceFile(sourceFile, context, remoteImportClauseToBrowser),
			context => sourceFile => visitSourceFile(sourceFile, context, importClauseToBrowser)
		]
	}
});
const browserDiagnostics = browserResult.getDiagnostics();

const nodeResult = await nodeProject.emitToMemory({
	customTransformers: {
		before: [
			context => sourceFile => visitSourceFile(sourceFile, context, remoteImportClauseToNode),
			context => sourceFile => visitSourceFile(sourceFile, context, importClauseToNode),
		]
	}
});
const nodeDiagnostics = nodeResult.getDiagnostics();

const diagnostics = [...browserDiagnostics, ...nodeDiagnostics];
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
	await Deno.writeTextFile(file.filePath, file.text);
}

await Deno.writeTextFile(
	join(__dirname, "npm/package.json"),
	JSON.stringify(
		{
			name: "@baseless/web",
			version: "0.0.0",
			description: "Baseless JS web",
			repository: {
				type: "git",
				url: "git+https://github.com/baseless-dev/baseless",
			},
			exports: Object.fromEntries(
				entryPoints.map(
					(entryPath) => {
						const key = "./" + relative(__dirname, entryPath);
						return [key.replace(/\.tsx?$/, ""), {
							node: key.replace(/\.tsx?$/, ".js"),
							browser: key.replace(/\.tsx?$/, ".mjs"),
							deno: key,
							types: key.replace(/\.tsx?$/, ".d.ts"),
						}];
					},
				),
			),
		},
		undefined,
		"  ",
	),
);

console.log(
	colors.green("✓") +
	colors.dim(
		` ${entryPoints.length} modules transformed in ${(performance.now() - timeStart).toFixed(0)
		}ms.`,
	),
);

Deno.exit(0);


function remoteImportClauseToBrowser(node: ts.Node, context: ts.TransformationContext) {
	if (
		(ts.isImportDeclaration(node)) &&
		node.moduleSpecifier &&
		ts.isStringLiteral(node.moduleSpecifier) &&
		!node.importClause?.isTypeOnly &&
		node.moduleSpecifier.text.match(/^https?:\/\//)
	) {
		console.log('Browser:', node.moduleSpecifier.text);
		// return context.factory.createImportDeclaration(node.modifiers, undefined, context.factory.createStringLiteral(node.moduleSpecifier.text.replace(/\.tsx?$/, ".mjs")), node.assertClause);
	}
	if (
		(ts.isExportDeclaration(node)) &&
		node.moduleSpecifier &&
		ts.isStringLiteral(node.moduleSpecifier) &&
		node.moduleSpecifier.text.match(/^https?:\/\//)
	) {
		console.log('Browser:', node.moduleSpecifier.text);
		// return context.factory.createExportDeclaration(node.modifiers, node.isTypeOnly, node.exportClause, context.factory.createStringLiteral(node.moduleSpecifier.text.replace(/\.tsx?$/, ".mjs")), node.assertClause);
	}
	return node;
}

function remoteImportClauseToNode(node: ts.Node, context: ts.TransformationContext) {
	if (
		(ts.isImportDeclaration(node)) &&
		node.moduleSpecifier &&
		ts.isStringLiteral(node.moduleSpecifier) &&
		node.moduleSpecifier.text.match(/^https?:\/\//)
	) {
		console.log('Node:', node.moduleSpecifier.text, node.importClause?.isTypeOnly);
		// return context.factory.createImportDeclaration(node.modifiers, undefined, context.factory.createStringLiteral(node.moduleSpecifier.text.replace(/\.tsx?$/, ".mjs")), node.assertClause);
	}
	if (
		(ts.isExportDeclaration(node)) &&
		node.moduleSpecifier &&
		ts.isStringLiteral(node.moduleSpecifier) &&
		node.moduleSpecifier.text.match(/^https?:\/\//)
	) {
		console.log('Node:', node.moduleSpecifier.text);
		// return context.factory.createExportDeclaration(node.modifiers, node.isTypeOnly, node.exportClause, context.factory.createStringLiteral(node.moduleSpecifier.text.replace(/\.tsx?$/, ".mjs")), node.assertClause);
	}
	return node;
}

function importClauseToBrowser(node: ts.Node, context: ts.TransformationContext) {
	if (
		ts.isImportDeclaration(node) &&
		node.moduleSpecifier &&
		ts.isStringLiteral(node.moduleSpecifier)
	) {
		return context.factory.createImportDeclaration(node.modifiers, node.importClause, context.factory.createStringLiteral(node.moduleSpecifier.text.replace(/\.tsx?$/, ".mjs")), node.assertClause);
	}
	if (
		ts.isExportDeclaration(node) &&
		node.moduleSpecifier &&
		ts.isStringLiteral(node.moduleSpecifier)
	) {
		return context.factory.createExportDeclaration(node.modifiers, node.isTypeOnly, node.exportClause, context.factory.createStringLiteral(node.moduleSpecifier.text.replace(/\.tsx?$/, ".mjs")), node.assertClause);
	}
	return node;
}

function importClauseToNode(node: ts.Node, context: ts.TransformationContext) {
	if (
		ts.isImportDeclaration(node) &&
		node.moduleSpecifier &&
		ts.isStringLiteral(node.moduleSpecifier)
	) {
		return context.factory.createImportDeclaration(node.modifiers, node.importClause, context.factory.createStringLiteral(node.moduleSpecifier.text.replace(/\.tsx?$/, "")), node.assertClause);
	}
	if (
		ts.isExportDeclaration(node) &&
		node.moduleSpecifier &&
		ts.isStringLiteral(node.moduleSpecifier)
	) {
		return context.factory.createExportDeclaration(node.modifiers, node.isTypeOnly, node.exportClause, context.factory.createStringLiteral(node.moduleSpecifier.text.replace(/\.tsx?$/, "")), node.assertClause);
	}
	return node;
}

function visitSourceFile(
	sourceFile: ts.SourceFile,
	context: ts.TransformationContext,
	visitNode: (node: ts.Node, context: ts.TransformationContext) => ts.Node,
) {
	return visitNodeAndChildren(sourceFile) as ts.SourceFile;

	function visitNodeAndChildren(node: ts.Node): ts.Node {
		return ts.visitEachChild(visitNode(node, context), visitNodeAndChildren, context);
	}
}