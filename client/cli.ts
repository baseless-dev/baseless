#!/usr/bin/env -S deno run --allow-read --allow-net
import { parseArgs } from "@std/cli/parse-args";
import { resolve } from "@std/path/resolve";
import { exists } from "@std/fs/exists";
import denoConfig from "./deno.json" with { type: "json" };
import { ApplicationBuilder } from "@baseless/server/application-builder";
import { Kind, TSchema, TypeGuard } from "@sinclair/typebox";

if (import.meta.main) {
	await main().catch((err) => console.error(err));
}

async function main(): Promise<void> {
	const args = parseArgs(Deno.args, {
		string: ["namedExport"],
		boolean: ["help", "defaultExport", "react", "version"],
		default: {
			help: false,
			defaultExport: false,
			namedExport: "BaselessApp",
			react: false,
			version: false,
		},
		alias: {
			d: "defaultExport",
			h: "help",
			n: "namedExport",
			r: "react",
			v: "version",
		},
	});

	if (args.help) {
		return printUsage();
	}

	if (args.version) {
		return console.log(`Baseless Client Generator ${denoConfig.version}`);
	}

	const path = args._[0]?.toString() ?? "";
	const absolutePath = resolve(path);

	if (!await exists(absolutePath)) {
		return console.error(`Path "${path}" does not exist.`);
	}

	const module = await import(import.meta.resolve(absolutePath));
	const appBuilder = module[args.defaultExport ? "default" : args.namedExport];

	if (!appBuilder) {
		return console.error(`Could not find export "${args.defaultExport ? "default" : args.namedExport}" in "${path}".`);
	}

	if (!(appBuilder instanceof ApplicationBuilder)) {
		return console.error(
			`Export "${args.defaultExport ? "default" : args.namedExport}" in "${path}" is not an instance of ApplicationBuilder.`,
		);
	}

	const types = new Set<string>();

	const { rpc, event, document, collection } = appBuilder.inspect();

	const namedExports = new Map<string, string>();
	const rpcs: string[] = [];
	const events: string[] = [];
	const documents: string[] = [];
	const collections: string[] = [];

	for (const def of rpc) {
		if ("security" in def) {
			const path = def.path.map((s: string) => `"${s}"`);
			const input = visit(def.input, types, namedExports);
			const output = visit(def.output, types, namedExports);
			rpcs.push(`RpcDefinitionWithSecurity<[${path}], ${input}, ${output}>`);
		}
	}
	for (const def of event) {
		if ("security" in def) {
			const path = def.path.map((s: string) => `"${s}"`);
			const payload = visit(def.payload, types, namedExports);
			events.push(`EventDefinitionWithSecurity<[${path}], ${payload}>`);
		}
	}
	for (const def of document) {
		if ("security" in def) {
			const path = def.path.map((s: string) => `"${s}"`);
			const schema = visit(def.schema, types, namedExports);
			documents.push(`DocumentDefinitionWithSecurity<[${path}], ${schema}>`);
		}
	}
	for (const def of collection) {
		if ("security" in def) {
			const path = def.path.map((s: string) => `"${s}"`);
			const schema = visit(def.schema, types, namedExports);
			collections.push(`CollectionDefinitionWithSecurity<[${path}], ${schema}>`);
			documents.push(`DocumentDefinitionWithSecurity<[${path}, "{docId}"], ${schema}>`);
		}
	}

	const [typeboxTypes, baselessCore] = Array.from(types).reduce(([typeboxTypes, baselessCore], type) => {
		if (type === "TID") {
			return [typeboxTypes, [...baselessCore, type]];
		}
		return [[...typeboxTypes, type], baselessCore];
	}, [[], []] as [string[], string[]]);
	typeboxTypes.push("Static");

	let gen = `/// This file is auto-generated with jsr:@baseless/client@${denoConfig.version}/bls command line\n\n`;

	gen +=
		`// deno-fmt-ignore-file\n// deno-lint-ignore-file ban-types no-unused-vars\n/* eslint-disable @typescript-eslint/no-empty-object-type */\n/* eslint-disable @typescript-eslint/no-unused-vars */\n`;

	if (typeboxTypes.length > 0) {
		gen += `import type { ${typeboxTypes.join(", ")} } from "@sinclair/typebox";\n`;
	}
	if (baselessCore.length > 0) {
		gen += `import type { ${baselessCore.join(", ")} } from "@baseless/core/id";\n`;
	}
	gen +=
		`import type { ApplicationBuilder, RpcDefinitionWithSecurity, EventDefinitionWithSecurity, DocumentDefinitionWithSecurity, CollectionDefinitionWithSecurity } from "@baseless/server";\n\n`;

	for (const [name, schema] of namedExports) {
		gen += `export type ${name}Schema = ${schema};\n`;
		gen += `export type ${name} = Static<${name}Schema>;\n`;
	}

	gen += `export type GeneratedApplicationBuilder = ApplicationBuilder<
	{},
	{},
	[\n\t\t${rpcs.join(`,\n\t\t`)}\n\t],
	[\n\t\t${events.join(`,\n\t\t`)}\n\t],
	[\n\t\t${documents.join(`,\n\t\t`)}\n\t],
	[\n\t\t${collections.join(`,\n\t\t`)}\n\t],
	[],
	[]
>;\n`;

	if (args.react) {
		gen += `declare module '@baseless/react' {
	interface TClient {
		rpcs: [\n\t\t${rpcs.join(`,\n\t\t`)}\n\t];
		events: [\n\t\t${events.join(`,\n\t\t`)}\n\t];
		documents: [\n\t\t${documents.join(`,\n\t\t`)}\n\t];
		collections: [\n\t\t${collections.join(`,\n\t\t`)}\n\t];
		files: [];
		folders: [];
	}
}`;
	}

	console.log(gen);
}

function printUsage(): void {
	console.log(`Baseless Client Generator ${denoConfig.version}
	Generate typed client from server application.
  
  INSTALL:
	deno install --allow-read jsr:@baseless/client@${denoConfig.version}/bls
  
  USAGE:
	bls [path] [options]
  
  OPTIONS:
	-h, --help                Prints help information
	-d, --defaultExport       Application is default export
	-n, --namedExport <NAME>  Application is named export
	-r, --react               Generate @baseless/react typed client
	-V, --version             Print version information`);
}

function visit(schema: TSchema, types = new Set<string>(), named = new Map<string, string>()): string {
	function _add(type: string): string {
		types.add(type);
		return type;
	}
	function _visit(schema: TSchema, skip?: string): string {
		let ret: string | undefined;
		if (TypeGuard.IsOptional(schema) && skip !== "TOptional") {
			_add("TOptional");
			ret = `TOptional<${_visit(schema, "TOptional")}>`;
		} else if (TypeGuard.IsReadonly(schema) && skip !== "TReadonly") {
			_add("TReadonly");
			ret = `TReadonly<${_visit(schema, "TReadonly")}>`;
		} else if (TypeGuard.IsRecursive(schema) && skip !== "TRecursive") {
			_add("TRecursive");
			ret = `TRecursive<${_visit(schema, "TRecursive")}>`;
		} else if (TypeGuard.IsTransform(schema) && skip !== "TTransform") {
			_add("TTransform");
			ret = `TTransform<${_visit(schema, "TTransform")}>`;
		} else if (TypeGuard.IsAny(schema)) {
			ret = _add("TAny");
		} else if (TypeGuard.IsArray(schema)) {
			_add("TArray");
			ret = `TArray<${_visit(schema.items)}>`;
		} else if (TypeGuard.IsAsyncIterator(schema)) {
			_add("TAsyncIterator");
			ret = `TAsyncIterator<${_visit(schema.items)}>`;
		} else if (TypeGuard.IsBigInt(schema)) {
			ret = _add("TBigInt");
		} else if (TypeGuard.IsBoolean(schema)) {
			ret = _add("TBoolean");
		} else if (TypeGuard.IsConstructor(schema)) {
			_add("TConstructor");
			ret = `TConstructor<[${schema.parameters.map((t) => _visit(t)).join(", ")}], ${_visit(schema.returns)}>`;
		} else if (TypeGuard.IsDate(schema)) {
			ret = _add("TDate");
		} else if (TypeGuard.IsFunction(schema)) {
			_add("TFunction");
			ret = `TFunction<[${schema.parameters.map((t) => _visit(t)).join(", ")}], ${_visit(schema.returns)}>`;
		} else if (TypeGuard.IsInteger(schema)) {
			ret = _add("TInteger");
		} else if (TypeGuard.IsIntersect(schema)) {
			_add("TIntersect");
			ret = `TIntersect<[${schema.allOf.map((t) => _visit(t)).join(", ")}]>`;
		} else if (TypeGuard.IsIterator(schema)) {
			_add("TIterator");
			ret = `TIterator<${_visit(schema.items)}>`;
		} else if (TypeGuard.IsLiteral(schema)) {
			_add("TLiteral");
			ret = `TLiteral<${JSON.stringify(schema.const)}>`;
		} else if (TypeGuard.IsNever(schema)) {
			ret = _add("TNever");
		} else if (TypeGuard.IsNot(schema)) {
			_add("TNot");
			ret = `TNot<${_visit(schema.not)}>`;
		} else if (TypeGuard.IsNull(schema)) {
			ret = _add("TNull");
		}
		if (TypeGuard.IsNumber(schema)) {
			ret = _add("TNumber");
		} else if (TypeGuard.IsObject(schema)) {
			_add("TObject");
			ret = `TObject<{${Object.entries(schema.properties).map(([key, value]) => `${key}: ${_visit(value)}`).join("; ")}}>`;
		} else if (TypeGuard.IsPromise(schema)) {
			_add("TPromise");
			ret = `TPromise<${_visit(schema.item)}>`;
		} else if (TypeGuard.IsRecord(schema)) {
			_add("TRecord");
			for (const [key, value] of globalThis.Object.entries(schema.patternProperties)) {
				const typeValue = _visit(value);
				const typeKey = _add(key === `^(0|[1-9][0-9]*)$` ? "TNumber" : "TString");
				ret = `TRecord<${typeKey}, ${typeValue}>`;
			}
		} else if (TypeGuard.IsRef(schema)) {
			// if (!reference_map.has(schema.$ref!)) ret = UnsupportedType(schema) // throw new ModelToZodNonReferentialType(schema.$ref!)
			// ret = schema.$ref
			throw "TODO2";
		} else if (TypeGuard.IsRegExp(schema)) {
			ret = _add("TRegExp");
		} // else if (TypeGuard.IsSchema(schema)) {
		// 	ret = _add("TSchema");
		// }
		else if (TypeGuard.IsString(schema)) {
			ret = _add("TString");
		} else if (TypeGuard.IsSymbol(schema)) {
			ret = _add("TSymbol");
		} else if (TypeGuard.IsTemplateLiteral(schema)) {
			_add("TTemplateLiteral");
			const parts: string[] = [];
			let prevOffset = 0;
			const pattern = schema.pattern.slice(1, -1);
			pattern.replace(/(\(0\|\[1\-9\]\[0\-9\]\*\)|\(\.\*\))/g, (match, _, offset) => {
				if (prevOffset != offset) {
					_add("TLiteral");
					parts.push(`TLiteral<"${pattern.substring(prevOffset, offset).replace(/\\([\\\^\$\.\|\?\*\+\(\)\[\]\{\}])/g, "$1")}">`);
				}
				if (match === "(.*)") {
					parts.push(_add("TString"));
				} else if (match === "(0|[1-9][0-9]*)") {
					parts.push(_add("TNumber"));
				} else {
					_add("TLiteral");
					parts.push(`TLiteral<"${match.replace(/\\([\\\^\$\.\|\?\*\+\(\)\[\]\{\}])/g, "$1")}">`);
				}
				prevOffset = offset += match.length;
				return "";
			});
			if (prevOffset !== pattern.length) {
				_add("TLiteral");
				parts.push(`TLiteral<"${pattern.substring(prevOffset).replace(/\\([\\\^\$\.\|\?\*\+\(\)\[\]\{\}])/g, "$1")}">`);
			}
			ret = `TTemplateLiteral<[${parts.join(", ")}]>`;
		} else if (TypeGuard.IsThis(schema)) {
			ret = _add("TThis");
		} else if (TypeGuard.IsTuple(schema)) {
			_add("TTuple");
			ret = `TTuple<[${schema.items?.map((t) => _visit(t)).join(", ")}]>`;
		} else if (TypeGuard.IsUint8Array(schema)) {
			ret = _add("TUint8Array");
		} else if (TypeGuard.IsUndefined(schema)) {
			ret = _add("TUndefined");
		} else if (TypeGuard.IsUnion(schema)) {
			_add("TUnion");
			ret = `TUnion<[${schema.anyOf.map((t) => _visit(t)).join(", ")}]>`;
		} else if (TypeGuard.IsUnknown(schema)) {
			ret = _add("TUnknown");
		} else if (TypeGuard.IsVoid(schema)) {
			ret = _add("TVoid");
		} else if (schema[Kind] === "ID") {
			_add("TID");
			ret = `TID<"${schema.prefix}">`;
		}
		if (ret) {
			if (schema.$id) {
				named.set(schema.$id, ret);
				return `${schema.$id}Schema`;
			}
			return ret;
		}
		throw `Unsupported type ${schema[Kind]}.`;
	}

	return _visit(schema);
}
