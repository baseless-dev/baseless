#!/usr/bin/env -S deno run --allow-read --allow-net
import { parseArgs } from "@std/cli/parse-args";
import { resolve } from "@std/path/resolve";
import { toFileUrl } from "@std/path/to-file-url";
import { exists } from "@std/fs/exists";
import { relative } from "@std/path/relative";
import { dirname } from "@std/path/dirname";
import denoConfig from "./deno.json" with { type: "json" };
import { generateDeclarationTypes } from "./generate_declaration_types.ts";

if (import.meta.main) {
	await main().catch((err) => console.error(err));
}

async function main(): Promise<void> {
	const args = parseArgs(Deno.args, {
		boolean: ["help", "version", "server"],
		default: {
			help: false,
			version: false,
			server: false,
		},
		alias: {
			h: "help",
			v: "version",
			s: "server",
		},
	});

	if (args.help) {
		return printUsage();
	}

	if (args.version) {
		return console.log(`Baseless Client Generator ${denoConfig.version}`);
	}

	const appPath = args._[0]?.toString() ?? "";
	const destPath = args._[1]?.toString() ?? "";
	const appAbsolutePath = resolve(appPath);
	const destAbsolutePath = resolve(destPath);
	let relativeImport = relative(dirname(destAbsolutePath), appAbsolutePath);
	if (!relativeImport.startsWith(".")) {
		relativeImport = `./${relativeImport}`;
	}

	if (!await exists(appAbsolutePath)) {
		return console.error(`Path "${appPath}" does not exist.`);
	}

	const appPathUrl = toFileUrl(appAbsolutePath);
	const exports = await import(appPathUrl.toString());

	const types = generateDeclarationTypes({ exports, relativeImport, generateServer: args.server });

	await Deno.writeFile(destAbsolutePath, new TextEncoder().encode(types));
}

function printUsage(): void {
	console.log(`Baseless Generator ${denoConfig.version}
	Generate types from application.
  
  INSTALL:
	deno install --allow-read -name baseless jsr:@baseless/cli@${denoConfig.version}
  
  USAGE:
	baseless [options] [path] [destination]
  
  OPTIONS:
	-h, --help                Prints help information
	-V, --version             Print version information
	-s, --server              Generate server types instead of client`);
}
