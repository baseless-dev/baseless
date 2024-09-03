import { transpile } from "jsr:@deno/emit";
import { walk } from "jsr:@std/fs";
import { dirname, extname, fromFileUrl, globToRegExp, join, relative, toFileUrl } from "jsr:@std/path";

const rm = (path: string) => Deno.remove(path, { recursive: true }).catch((_) => {});
const clearDir = async (path: string) => {
	for await (const entry of Deno.readDir(path)) {
		await rm(join(path, entry.name));
	}
};
const mkdir = (path: string) => Deno.mkdir(path, { recursive: true });

const { workspace: workspaces, imports } = JSON.parse(await Deno.readTextFile(join(import.meta.dirname!, "./deno.jsonc"))) as {
	workspace: string[];
	imports: Record<string, string>;
};

workspaces.splice(0, workspaces.length, "./core");

for (const workspace of workspaces) {
	const config = JSON.parse(await Deno.readTextFile(join(import.meta.dirname!, workspace, "deno.jsonc"))) as {
		name: string;
		version: string;
		exports: Record<string, string>;
		publish?: {
			include?: string[];
			exclude?: string[];
		};
	};
	const walkedFiles = await Array.fromAsync(walk(join(import.meta.dirname!, workspace), {
		match: config.publish?.include?.map((p) => globToRegExp(join(import.meta.dirname!, workspace, p))) ?? [],
		skip: config.publish?.exclude?.map((p) => globToRegExp(join(import.meta.dirname!, workspace, p))) ?? [],
	}));
	const files = [
		join(import.meta.dirname!, workspace, "deno.jsonc"),
		...walkedFiles.map((file) => file.path),
	];

	const rootDir = join(import.meta.dirname!, "_npm", config.name);

	await mkdir(rootDir);
	await clearDir(rootDir);

	await Deno.writeTextFile(
		join(import.meta.dirname!, "_npm", config.name, ".npmrc"),
		"@jsr:registry=https://npm.jsr.io",
	);

	await Deno.writeTextFile(
		join(import.meta.dirname!, "_npm", config.name, "package.json"),
		JSON.stringify(
			{
				name: config.name,
				version: config.version,
				exports: config.exports,
				dependencies: Object.fromEntries(
					Object.values(imports).map((
						v,
					) => [
						v.match(/^(npm|jsr):(.*)@([^\/]*)/)![2],
						v.replace(/^npm:(.*)@([^\\/]+).*$/, "$2").replace(/^jsr:@(.*)/, (_, p) => `npm:@jsr/${p.replaceAll("/", "__")}`),
					]),
				),
			},
			undefined,
			"  ",
		),
	);

	await Deno.writeTextFile(
		join(import.meta.dirname!, "_npm", config.name, "tsconfig.json"),
		JSON.stringify(
			{
				"compilerOptions": {
					"target": "ESNext",
					"module": "NodeNext",
					"moduleResolution": "NodeNext",
					"noCheck": true,
					"declaration": true,
					"emitDeclarationOnly": true,
					"allowImportingTsExtensions": true,
				},
			},
			undefined,
			"  ",
		),
	);

	for (const file of files) {
		const ext = extname(file);

		if (ext === ".ts" || ext === ".tsx") {
			const result = await transpile(toFileUrl(file), {
				importMap: { imports },
				allowRemote: true,
				compilerOptions: { sourceMap: true },
			});
			for (const [file, content] of result) {
				const target = join(
					import.meta.dirname!,
					"_npm",
					config.name,
					relative(join(import.meta.dirname!, workspace), fromFileUrl(file)),
				);
				await mkdir(dirname(target));
				await Deno.writeTextFile(target, content);
			}
		} else {
			const target = join(import.meta.dirname!, "_npm", config.name, relative(join(import.meta.dirname!, workspace), file));
			await mkdir(dirname(target));
			await Deno.writeTextFile(target, await Deno.readTextFile(file));
		}
	}
}
