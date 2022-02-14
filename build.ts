import { parse } from "https://deno.land/std@0.120.0/flags/mod.ts";
import { expandGlob } from "https://deno.land/std@0.120.0/fs/expand_glob.ts";
import { basename, dirname, fromFileUrl, join, relative, resolve } from "https://deno.land/std@0.120.0/path/mod.ts";
import { createProject, ts } from "https://deno.land/x/ts_morph/bootstrap/mod.ts";
import { debounce } from "https://deno.land/std@0.121.0/async/debounce.ts";

export async function build() {
	const cwd = Deno.cwd();
	const project = await createProject({ useInMemoryFileSystem: true });
	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
	for await (
		const entry of expandGlob("*/package.json", { root: "./modules" })
	) {
		let buffer: Uint8Array;
		let json: Record<string, unknown>;
		try {
			buffer = await Deno.readFile(entry.path);
			json = JSON.parse(new TextDecoder().decode(buffer));
		} catch (_err) {
			continue;
		}

		if (!json.name || !json.main) {
			continue;
		}

		const root = relative(cwd, dirname(entry.path));
		const name = basename(root);
		console.log(`Building module ${name}...`);

		const main = join(root, json.main as string);

		const universalBuild: {
			targets?: string[];
			node?: Record<string, string>;
			browser?: Record<string, string>;
		} = json.universalBuild as any ?? {};

		const targets: string[] = universalBuild.targets ?? [];

		const nodeMappings = Object.entries(universalBuild.node ?? {}).map(
			([key, pkg]: [string, string]) => {
				const parts = pkg.split("@");
				return [
					new RegExp(key),
					parts.slice(0, -1).join("@"),
					parts.pop()!,
				] as const;
			},
		);

		const browserMappings = Object.entries(universalBuild.browser ?? {}).map((
			[key, val]: [string, string],
		) => ([new RegExp(key), val] as const));

		const nodeDependencies = new Set<string>();

		// Build browser
		if (targets.includes("browser")) {
			console.debug(`  Transpiling browser modules...`);
			const outDir = join("./dist", name, "browser");
			await Deno.remove(outDir, { recursive: true }).catch((_) => {});

			const { files } = await Deno.emit(main, {
				importMapPath: "./import-map.json",
				compilerOptions: { sourceMap: false, target: "esnext" },
			});

			const filteredFiles = Object.entries(files).reduce(
				(map, [key, content]) => {
					const url = new URL(key);
					if (url.protocol === "file:") {
						const path = relative(root, fromFileUrl(url));
						if (
							!path.substring(0, 3).match(/^\.\.[\\/]?/) && path.match(/\.js$/)
						) {
							map[path] = content;
						}
					}
					return map;
				},
				{} as Record<string, string>,
			);

			for (const [path, content] of Object.entries(filteredFiles)) {
				const dest = join(outDir, path.replace(/\.ts\.js$/, ".js"));
				const sourceFile = ts.createSourceFile(
					basename(path),
					content,
					ts.ScriptTarget.Latest,
				);
				ts.forEachChild(sourceFile, function visit(node) {
					if (
						(ts.isImportDeclaration(node) ||
							ts.isExportDeclaration(node)) &&
						node.moduleSpecifier &&
						ts.isStringLiteral(node.moduleSpecifier)
					) {
						for (const [pattern, pkg] of browserMappings) {
							if (pattern.test(node.moduleSpecifier.text)) {
								node.moduleSpecifier.text = pkg;
								break;
							}
						}
						node.moduleSpecifier.text = node.moduleSpecifier.text.replace(
							/\.ts$/,
							".js",
						);
					}
					ts.forEachChild(node, visit);
				});
				const out = printer.printFile(sourceFile).replace(
					/\/\/\/ <amd-module name="[^"]*" \/>\s*/g,
					"",
				);
				await Deno.mkdir(dirname(dest), { recursive: true });
				await Deno.writeFile(dest, new TextEncoder().encode(out));
			}
		}

		// Build Deno
		if (targets.includes("deno")) {
			console.debug(`  Copying Deno modules...`);
			const outDir = join("./dist", name, "deno");
			await Deno.remove(outDir, { recursive: true }).catch((_) => {});

			for await (
				const entry of expandGlob(join(root, "**/*.{ts,tsx,js,mjs,jsx}"))
			) {
				const dest = join(outDir, relative(root, entry.path));
				await Deno.mkdir(dirname(dest), { recursive: true });
				await Deno.copyFile(entry.path, dest);
			}
		}

		// // Build types
		// if (targets.includes("node")) {
		// 	console.debug(`  Transpiling types...`);
		// 	const outDir = join("./dist", name, "types");
		// 	await Deno.remove(outDir, { recursive: true }).catch((_) => {});

		// 	const { files } = await Deno.emit(main, {
		// 		importMapPath: "./import-map.json",
		// 		compilerOptions: { emitDeclarationOnly: true, declaration: true },
		// 	});

		// 	const filteredFiles = Object.entries(files).reduce(
		// 		(map, [key, content]) => {
		// 			if (key.match(/\.ts\.d\.ts$/)) {
		// 				const url = new URL(key);
		// 				if (url.protocol === "file:") {
		// 					const path = relative(root, fromFileUrl(url));
		// 					if (!path.substring(0, 3).match(/^\.\.[\\/]?/)) {
		// 						map[path] = content;
		// 					}
		// 				}
		// 			}
		// 			return map;
		// 		},
		// 		{} as Record<string, string>,
		// 	);

		// 	for (const [path, content] of Object.entries(filteredFiles)) {
		// 		const dest = join(outDir, path.replace(/\.ts\.d\.ts$/, ".d.ts"));
		// 		const sourceFile = ts.createSourceFile(
		// 			basename(path),
		// 			content,
		// 			ts.ScriptTarget.Latest,
		// 		);
		// 		ts.forEachChild(sourceFile, function visit(node) {
		// 			if (
		// 				(ts.isImportDeclaration(node) ||
		// 					ts.isExportDeclaration(node)) &&
		// 				node.moduleSpecifier &&
		// 				ts.isStringLiteral(node.moduleSpecifier)
		// 			) {
		// 				for (const [pattern, pkg, ver] of nodeMappings) {
		// 					if (pattern.test(node.moduleSpecifier.text)) {
		// 						node.moduleSpecifier.text = pkg;
		// 						nodeDependencies.add(pkg + "@" + ver);
		// 						break;
		// 					}
		// 				}
		// 				node.moduleSpecifier.text = node.moduleSpecifier.text.replace(
		// 					/\.ts$/,
		// 					".js",
		// 				);
		// 			} else if (
		// 				node.kind === ts.SyntaxKind.LastTypeNode &&
		// 				ts.isLiteralTypeNode((node as any).argument) &&
		// 				ts.isStringLiteral((node as any).argument.literal)
		// 			) {
		// 				for (const [pattern, pkg, ver] of nodeMappings) {
		// 					if (pattern.test((node as any).argument.literal.text)) {
		// 						(node as any).argument.literal.text = pkg;
		// 						nodeDependencies.add(pkg + "@" + ver);
		// 						break;
		// 					}
		// 				}
		// 				(node as any).argument.literal.text = (node as any).argument
		// 					.literal.text.replace(
		// 						/\.ts$/,
		// 						".js",
		// 					);
		// 			}
		// 			ts.forEachChild(node, visit);
		// 		});
		// 		const out = printer.printFile(sourceFile).replace(
		// 			/\/\/\/ <amd-module name="[^"]*" \/>\s*/g,
		// 			"",
		// 		);
		// 		await Deno.mkdir(dirname(dest), { recursive: true });
		// 		await Deno.writeFile(dest, new TextEncoder().encode(out));
		// 	}
		// }

		// // Build Nodejs ESM
		// if (targets.includes("node")) {
		// 	console.debug(`  Transpiling Nodejs ESM modules...`);
		// 	const outDir = join("./dist", name, "node/esm");
		// 	await Deno.remove(outDir, { recursive: true }).catch((_) => {});

		// 	const { files } = await Deno.emit(main, {
		// 		importMapPath: "./import-map.json",
		// 		compilerOptions: {
		// 			sourceMap: false,
		// 			declaration: false,
		// 			emitDeclarationOnly: false,
		// 			target: "esnext",
		// 			module: "esnext",
		// 		},
		// 	});

		// 	const filteredFiles = Object.entries(files).reduce(
		// 		(map, [key, content]) => {
		// 			if (key.match(/\.ts\.js$/)) {
		// 				const url = new URL(key);
		// 				if (url.protocol === "file:") {
		// 					const path = relative(root, fromFileUrl(url));
		// 					if (!path.substring(0, 3).match(/^\.\.[\\/]?/)) {
		// 						map[path] = content;
		// 					}
		// 				}
		// 			}
		// 			return map;
		// 		},
		// 		{} as Record<string, string>,
		// 	);

		// 	for (const [path, content] of Object.entries(filteredFiles)) {
		// 		const dest = join(outDir, path.replace(/\.ts\.js$/, ".js"));
		// 		const sourceFile = ts.createSourceFile(
		// 			basename(path),
		// 			content,
		// 			ts.ScriptTarget.Latest,
		// 		);
		// 		ts.forEachChild(sourceFile, function visit(node) {
		// 			if (
		// 				(ts.isImportDeclaration(node) ||
		// 					ts.isExportDeclaration(node)) &&
		// 				node.moduleSpecifier &&
		// 				ts.isStringLiteral(node.moduleSpecifier)
		// 			) {
		// 				for (const [pattern, pkg, ver] of nodeMappings) {
		// 					if (pattern.test(node.moduleSpecifier.text)) {
		// 						node.moduleSpecifier.text = pkg;
		// 						nodeDependencies.add(pkg + "@" + ver);
		// 						break;
		// 					}
		// 				}
		// 				node.moduleSpecifier.text = node.moduleSpecifier.text.replace(
		// 					/\.ts$/,
		// 					"",
		// 				);
		// 			}
		// 			ts.forEachChild(node, visit);
		// 		});
		// 		const out = printer.printFile(sourceFile).replace(
		// 			/\/\/\/ <amd-module name="[^"]*" \/>\s*/g,
		// 			"",
		// 		);
		// 		await Deno.mkdir(dirname(dest), { recursive: true });
		// 		await Deno.writeFile(dest, new TextEncoder().encode(out));
		// 		await Deno.writeFile(
		// 			join(outDir, "package.json"),
		// 			new TextEncoder().encode(`{ "type": "module" }`),
		// 		);
		// 	}
		// }

		// // Build Nodejs CJS
		// if (targets.includes("node")) {
		// 	console.debug(`  Transpiling Nodejs CJS modules...`);
		// 	const outDir = join("./dist", name, "node/cjs");
		// 	await Deno.remove(outDir, { recursive: true }).catch((_) => {});

		// 	const { files } = await Deno.emit(main, {
		// 		importMapPath: "./import-map.json",
		// 		compilerOptions: {
		// 			sourceMap: false,
		// 			declaration: false,
		// 			emitDeclarationOnly: false,
		// 			target: "es2015",
		// 			module: "commonjs",
		// 		},
		// 	});

		// 	const filteredFiles = Object.entries(files).reduce(
		// 		(map, [key, content]) => {
		// 			if (key.match(/\.ts\.js$/)) {
		// 				const url = new URL(key);
		// 				if (url.protocol === "file:") {
		// 					const path = relative(root, fromFileUrl(url));
		// 					if (!path.substring(0, 3).match(/^\.\.[\\/]?/)) {
		// 						map[path] = content;
		// 					}
		// 				}
		// 			}
		// 			return map;
		// 		},
		// 		{} as Record<string, string>,
		// 	);

		// 	for (const [path, content] of Object.entries(filteredFiles)) {
		// 		const dest = join(outDir, path.replace(/\.ts\.js$/, ".js"));
		// 		const sourceFile = ts.createSourceFile(
		// 			basename(path),
		// 			content,
		// 			ts.ScriptTarget.Latest,
		// 		);
		// 		ts.forEachChild(sourceFile, function visit(node) {
		// 			if (
		// 				ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
		// 				node.expression.escapedText === "require"
		// 			) {
		// 				for (const arg of node.arguments) {
		// 					if (ts.isStringLiteral(arg)) {
		// 						const url = new URL(arg.text);
		// 						if (url.protocol === "file:") {
		// 							arg.text = relative(root, fromFileUrl(url));
		// 						}
		// 						for (const [pattern, pkg, ver] of nodeMappings) {
		// 							if (pattern.test(arg.text)) {
		// 								arg.text = pkg;
		// 								nodeDependencies.add(pkg + "@" + ver);
		// 							}
		// 							break;
		// 						}
		// 						arg.text = arg.text.replace(
		// 							/\.ts$/,
		// 							".js",
		// 						);
		// 					}
		// 				}
		// 			}
		// 			ts.forEachChild(node, visit);
		// 		});
		// 		const out = printer.printFile(sourceFile).replace(
		// 			/\/\/\/ <amd-module name="[^"]*" \/>\s*/g,
		// 			"",
		// 		);
		// 		await Deno.mkdir(dirname(dest), { recursive: true });
		// 		await Deno.writeFile(dest, new TextEncoder().encode(out));
		// 		await Deno.writeFile(
		// 			join(outDir, "package.json"),
		// 			new TextEncoder().encode(`{ "type": "commonjs" }`),
		// 		);
		// 	}
		// }

		// // Build package.json
		// if (targets.includes("node")) {
		// 	console.log(
		// 		`  Dependencies ${Array.from(nodeDependencies).join(", ")}`,
		// 	);
		// }
	}
	console.log("Done!");
}

const args = parse(Deno.args);

function printUsage() {
	console.log(`A universal Typscript builder`);
	console.log(``);
	console.log(
		`USAGE:\n  deno run --unstable -A build.ts`,
	);
	console.log(``);
	console.log(`OPTIONS:`);
	console.log(
		`  --help                   Print help information`,
		`  --watch                  Watch for changes and rebuild`,
	);
}

if (import.meta.main) {
	await Deno.permissions.request({ name: "read" });
	await Deno.permissions.request({ name: "read", path: "./modules" });
	await Deno.permissions.request({ name: "write", path: "./dist" });
	await Deno.permissions.request({ name: "net" });

	// deno-lint-ignore no-extra-boolean-cast
	if (!!args.help) {
		printUsage();
	} else {
		if (!!args.watch) {
			const watcher = Deno.watchFs("./modules", { recursive: true });

			let building = false;
			const handle = debounce(async () => {
				console.log("Changes detected, rebuilding...");
				if (!building) {
					building = true;
					await build();
					building = false;
				}
			}, 200);

			console.log("Watching for changes...");
			for await (const event of watcher) {
				if (["create", "modify", "remove"].includes(event.kind)) {
					handle();
				}
			}
		} else {
			await build();
		}
	}
}
