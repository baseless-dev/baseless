// import { transpile } from "jsr:@deno/emit";
import ts from "npm:typescript";
import { walk } from "jsr:@std/fs";
import { dirname, extname, globToRegExp, join, relative } from "jsr:@std/path";
import * as colors from "jsr:@std/fmt/colors";
import { format } from "jsr:@std/fmt/duration";

const rm = (path: string) => Deno.remove(path, { recursive: true }).catch((_) => {});
const clearDir = async (path: string) => {
	for await (const entry of Deno.readDir(path)) {
		await rm(join(path, entry.name));
	}
};
const mkdir = (path: string) => Deno.mkdir(path, { recursive: true });

const timeStart = performance.now();

const cwd = Deno.cwd();

const { workspace: workspaces, imports } = JSON.parse(await Deno.readTextFile(join(cwd, "./deno.jsonc"))) as {
	workspace: string[];
	imports: Record<string, string>;
};

const workspaceSummaries: Array<PackageSummary> = [];

for (const workspace of workspaces) {
	const config = JSON.parse(await Deno.readTextFile(join(cwd, workspace, "deno.jsonc"))) as PackageSummary;
	workspaceSummaries.push({ ...config, location: workspace });

	if (!Deno.args.includes("--only") || Deno.args.includes(config.name)) {
		const rootDir = join(cwd, "_npm", config.name);
		await mkdir(rootDir);
		await clearDir(rootDir);

		await Deno.writeTextFile(
			join(cwd, "_npm", config.name, "package.json"),
			JSON.stringify(
				{
					name: config.name,
					version: config.version,
					type: "module",
					exports: Object.fromEntries(
						Object.entries(config.exports).map(([k, v]) => [k, {
							types: `./${join("./_dist", v.replace(/\.tsx?$/, ".d.ts"))}`,
							default: v.replace(/\.ts(x)?$/, ".js"),
						}]),
					),
					devDependencies: {
						"typescript": "*",
					},
					dependencies: Object.fromEntries(
						Object.values(imports).map((
							v,
						) => [
							v.match(/^(npm|jsr):(.*)@([^\/]*)/)![2],
							v.replace(/^npm:(.*)@([^\\/]+).*$/, "$2")
								.replace(/^jsr:@(.*)/, (_, p) => `npm:@jsr/${p.replaceAll("/", "__")}`),
						]),
					),
				},
				undefined,
				"  ",
			),
		);
	}
}

await Deno.writeTextFile(
	join(cwd, "_npm", ".npmrc"),
	"@jsr:registry=https://npm.jsr.io",
);
await Deno.writeTextFile(
	join(cwd, "_npm", "package.json"),
	JSON.stringify(
		{
			workspaces: workspaceSummaries.map((n) => `./${n.name}`),
		},
		undefined,
		"  ",
	),
);

console.log(colors.dim(`• Installing dependencies...`));

const npmInstall = new Deno.Command(`npm`, {
	cwd: join(cwd, "_npm"),
	args: ["i"],
	stdout: "null",
	stderr: "null",
})
	.spawn();
await npmInstall.status;

const printer = ts.createPrinter();

async function compileSummary(summary: PackageSummary): Promise<void> {
	console.log(colors.dim(`• Transpiling ${summary.name}...`));

	const workspaceRoot = join(cwd, summary.location);
	const packageRoot = join(cwd, "_npm", summary.name);
	const walkedFiles = await Array.fromAsync(walk(workspaceRoot, {
		match: summary.publish?.include?.map((p) => globToRegExp(join(workspaceRoot, p))) ?? [],
		skip: summary.publish?.exclude?.map((p) => globToRegExp(join(workspaceRoot, p))) ?? [],
	}));
	const files = [
		join(workspaceRoot, "deno.jsonc"),
		...walkedFiles.map((file) => file.path),
	];

	for (const file of files) {
		const ext = extname(file);

		if (ext === ".ts" || ext === ".tsx") {
			const source = ts.createSourceFile(file, await Deno.readTextFile(file), ts.ScriptTarget.ESNext);
			const transformed = ts.transform(source, [
				(context) => {
					const visit: ts.Visitor = (node) => {
						if (
							ts.isImportDeclaration(node) &&
							node.moduleSpecifier &&
							ts.isStringLiteral(node.moduleSpecifier)
						) {
							node.moduleSpecifier.text = node.moduleSpecifier.text.replace(/\.ts(x)?$/, ".js");
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
							node.moduleSpecifier.text = node.moduleSpecifier.text.replace(/\.ts(x)?$/, ".js");
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
			const output = printer.printFile(transformed.transformed[0]);
			const target = join(packageRoot, relative(workspaceRoot, file));
			await mkdir(dirname(target));
			await Deno.writeTextFile(target, output);
		} else {
			const target = join(packageRoot, relative(workspaceRoot, file));
			await mkdir(dirname(target));
			await Deno.writeTextFile(target, await Deno.readTextFile(file));
		}
	}

	await Deno.writeTextFile(
		join(packageRoot, "tsconfig.json"),
		JSON.stringify(
			{
				include: ["**/*.ts", "**/*.tsx"],
				exclude: ["node_modules"],
				compilerOptions: {
					target: "ESNext",
					module: "ESNext",
					moduleResolution: "NodeNext",
					allowImportingTsExtensions: true,
					jsx: "react-jsx",
					jsxImportSource: "react",
					jsxImportSourceTypes: "@types/react",
				},
			},
			undefined,
			"  ",
		),
	);

	const typeCompile = new Deno.Command(`npx`, {
		cwd: packageRoot,
		args: [
			"tsc",
			"--project",
			"tsconfig.json",
			"--emitDeclarationOnly",
			"--declaration",
			"--declarationMap",
			"--outDir",
			"_dist",
		],
		stdout: "null",
		stderr: "null",
	}).spawn();
	await typeCompile.status;

	const jsCompile = new Deno.Command(`npx`, {
		cwd: packageRoot,
		args: [
			"tsc",
			"--project",
			"tsconfig.json",
			"--sourceMap",
			"--outDir",
			"./",
		],
		stdout: "null",
		stderr: "null",
	}).spawn();
	await jsCompile.status;

	await rm(join(packageRoot, "tsconfig.json"));
}

for (const summary of workspaceSummaries) {
	if (!Deno.args.includes("--only") || Deno.args.includes(summary.name)) {
		await compileSummary(summary);
	}
}
console.log(colors.green("•") + colors.dim(` Done transpiling`));

console.log(colors.dim(`• Linking modules...`));

const npmLink = new Deno.Command(`npm`, {
	cwd: join(cwd, "_npm"),
	args: ["link", "--workspaces"],
	stdout: "null",
	stderr: "null",
})
	.spawn();
await npmLink.status;

console.log(colors.green("✓") + colors.dim(` Build took ${format(performance.now() - timeStart, { ignoreZero: true })}.`));

if (Deno.args.includes("--watch")) {
	console.log(colors.blue("○") + colors.dim(` Watching for changes...`));
	const workspaceChanges = new Set<PackageSummary>();
	let processChangesTimer: number | undefined;
	const processChanges = async () => {
		const changes = Array.from(workspaceChanges);
		workspaceChanges.clear();

		for (const change of changes) {
			await compileSummary(change);
		}
		console.log(colors.green("•") + colors.dim(` Done transpiling`));
		if (workspaceChanges.size) {
			processChangesTimer = setTimeout(processChanges, 100);
		} else {
			processChangesTimer = undefined;
		}
	};
	const watcher = Deno.watchFs(cwd);
	for await (const event of watcher) {
		if (event.kind === "modify" || event.kind === "create") {
			const file = event.paths[0];
			const workspaceSummary = workspaceSummaries.find((w) => file.startsWith(join(cwd, w.location)));
			if (workspaceSummary) {
				workspaceChanges.add(workspaceSummary);
				if (!processChangesTimer) {
					processChangesTimer = setTimeout(processChanges, 100);
				}
			}
		}
	}
}

type PackageSummary = {
	location: string;
	name: string;
	version: string;
	exports: Record<string, string>;
	publish?: {
		include?: string[];
		exclude?: string[];
	};
};
