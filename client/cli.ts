#!/usr/bin/env -S deno run --allow-read --allow-net
import { parseArgs } from "@std/cli/parse-args";
import { join } from "@std/path/join";
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
		boolean: ["help", "defaultExport", "version"],
		default: {
			help: false,
			defaultExport: false,
			namedExport: "BaselessApp",
			version: false,
		},
		alias: {
			d: "defaultExport",
			n: "namedExport",
			h: "help",
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
	const absolutePath = join(Deno.cwd(), path);

	if (!await exists(absolutePath)) {
		return console.error(`Path "${path}" does not exist.`);
	}

	const module = await import(absolutePath);
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

	const rpcs: string[] = [];
	const events: string[] = [];
	const documents: string[] = [];
	const collections: string[] = [];

	for (const def of rpc) {
		if ("security" in def) {
			const path = def.path.map((s: string) => `"${s}"`);
			const input = visit(def.input, types);
			const output = visit(def.output, types);
			rpcs.push(`RpcDefinitionWithSecurity<[${path}], ${input}, ${output}>`);
		}
	}
	for (const def of event) {
		if ("security" in def) {
			const path = def.path.map((s: string) => `"${s}"`);
			const payload = visit(def.payload, types);
			events.push(`EventDefinitionWithSecurity<[${path}], ${payload}>`);
		}
	}
	for (const def of document) {
		if ("security" in def) {
			const path = def.path.map((s: string) => `"${s}"`);
			const schema = visit(def.schema, types);
			documents.push(`DocumentDefinitionWithSecurity<[${path}], ${schema}>`);
		}
	}
	for (const def of collection) {
		if ("security" in def) {
			const path = def.path.map((s: string) => `"${s}"`);
			const schema = visit(def.schema, types);
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
		`import type { ApplicationBuilder, RpcDefinitionWithSecurity, EventDefinitionWithSecurity, DocumentDefinitionWithSecurity, CollectionDefinitionWithSecurity } from "@baseless/server";\n`;
	gen += `\nexport type GeneratedApplicationBuilder = ApplicationBuilder<
	{},
	[\n\t\t${rpcs.join(`,\n\t\t`)}\n\t],
	[\n\t\t${events.join(`,\n\t\t`)}\n\t],
	[\n\t\t${documents.join(`,\n\t\t`)}\n\t],
	[\n\t\t${collections.join(`,\n\t\t`)}\n\t],
	[],
	[]
>;`;

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
	-V, --version             Print version information`);
}

function visit(schema: TSchema, types = new Set<string>()): string {
	function _add(type: string): string {
		types.add(type);
		return type;
	}
	function _visit(schema: TSchema, skip?: string): string {
		if (TypeGuard.IsOptional(schema) && skip !== "TOptional") {
			_add("TOptional");
			return `TOptional<${_visit(schema, "TOptional")}>`;
		}
		if (TypeGuard.IsReadonly(schema) && skip !== "TReadonly") {
			_add("TReadonly");
			return `TReadonly<${_visit(schema, "TReadonly")}>`;
		}
		if (TypeGuard.IsRecursive(schema) && skip !== "TRecursive") {
			_add("TRecursive");
			return `TRecursive<${_visit(schema, "TRecursive")}>`;
		}
		if (TypeGuard.IsTransform(schema) && skip !== "TTransform") {
			_add("TTransform");
			return `TTransform<${_visit(schema, "TTransform")}>`;
		}
		if (TypeGuard.IsAny(schema)) {
			return _add("TAny");
		}
		if (TypeGuard.IsArray(schema)) {
			_add("TArray");
			return `TArray<${_visit(schema.items)}>`;
		}
		if (TypeGuard.IsAsyncIterator(schema)) {
			_add("TAsyncIterator");
			return `TAsyncIterator<${_visit(schema.items)}>`;
		}
		if (TypeGuard.IsBigInt(schema)) {
			return _add("TBigInt");
		}
		if (TypeGuard.IsBoolean(schema)) {
			return _add("TBoolean");
		}
		if (TypeGuard.IsConstructor(schema)) {
			_add("TConstructor");
			return `TConstructor<[${schema.parameters.map((t) => _visit(t)).join(", ")}], ${_visit(schema.returns)}>`;
		}
		if (TypeGuard.IsDate(schema)) {
			return _add("TDate");
		}
		if (TypeGuard.IsFunction(schema)) {
			_add("TFunction");
			return `TFunction<[${schema.parameters.map((t) => _visit(t)).join(", ")}], ${_visit(schema.returns)}>`;
		}
		if (TypeGuard.IsInteger(schema)) {
			return _add("TInteger");
		}
		if (TypeGuard.IsIntersect(schema)) {
			_add("TIntersect");
			return `TIntersect<[${schema.allOf.map((t) => _visit(t)).join(", ")}]>`;
		}
		if (TypeGuard.IsIterator(schema)) {
			_add("TIterator");
			return `TIterator<${_visit(schema.items)}>`;
		}
		if (TypeGuard.IsLiteral(schema)) {
			_add("TLiteral");
			return `TLiteral<${JSON.stringify(schema.const)}>`;
		}
		if (TypeGuard.IsNever(schema)) {
			return _add("TNever");
		}
		if (TypeGuard.IsNot(schema)) {
			_add("TNot");
			return `TNot<${_visit(schema.not)}>`;
		}
		if (TypeGuard.IsNull(schema)) {
			return _add("TNull");
		}
		if (TypeGuard.IsNumber(schema)) {
			return _add("TNumber");
		}
		if (TypeGuard.IsObject(schema)) {
			_add("TObject");
			return `TObject<{${Object.entries(schema.properties).map(([key, value]) => `${key}: ${_visit(value)}`).join("; ")}}>`;
		}
		if (TypeGuard.IsPromise(schema)) {
			_add("TPromise");
			return `TPromise<${_visit(schema.item)}>`;
		}
		if (TypeGuard.IsRecord(schema)) {
			_add("TRecord");
			for (const [key, value] of globalThis.Object.entries(schema.patternProperties)) {
				const typeValue = _visit(value);
				const typeKey = _add(key === `^(0|[1-9][0-9]*)$` ? "TNumber" : "TString");
				return `TRecord<${typeKey}, ${typeValue}>`;
			}
			throw "UnsupportedType";
		}
		if (TypeGuard.IsRef(schema)) {
			// if (!reference_map.has(schema.$ref!)) return UnsupportedType(schema) // throw new ModelToZodNonReferentialType(schema.$ref!)
			// return schema.$ref
			throw "TODO2";
		}
		if (TypeGuard.IsRegExp(schema)) {
			return _add("TRegExp");
		}
		// if (TypeGuard.IsSchema(schema)) {
		// 	return _add("TSchema");
		// }
		if (TypeGuard.IsString(schema)) {
			return _add("TString");
		}
		if (TypeGuard.IsSymbol(schema)) {
			return _add("TSymbol");
		}
		if (TypeGuard.IsTemplateLiteral(schema)) {
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
			return `TTemplateLiteral<[${parts.join(", ")}]>`;
		}
		if (TypeGuard.IsThis(schema)) {
			return _add("TThis");
		}
		if (TypeGuard.IsTuple(schema)) {
			_add("TTuple");
			return `TTuple<[${schema.items?.map((t) => _visit(t)).join(", ")}]>`;
		}
		if (TypeGuard.IsUint8Array(schema)) {
			return _add("TUint8Array");
		}
		if (TypeGuard.IsUndefined(schema)) {
			return _add("TUndefined");
		}
		if (TypeGuard.IsUnion(schema)) {
			_add("TUnion");
			return `TUnion<[${schema.anyOf.map((t) => _visit(t)).join(", ")}]>`;
		}
		if (TypeGuard.IsUnknown(schema)) {
			return _add("TUnknown");
		}
		if (TypeGuard.IsVoid(schema)) {
			return _add("TVoid");
		}
		if (schema[Kind] === "ID") {
			_add("TID");
			return `TID<"${schema.prefix}">`;
		}
		throw `Unsupported type ${schema[Kind]}.`;
	}

	return _visit(schema);
}
