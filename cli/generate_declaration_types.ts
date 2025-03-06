// deno-fmt-ignore-file
// deno-lint-ignore-file
import type {
	TCollection,
	TDecoration,
	TDefinition,
	TDocument,
	TOnRequest,
	TRequirement,
	TTopic,
} from "@baseless/server";
import * as Type from "@baseless/core/schema";
import { convertPathToParams, convertPathToTemplate } from "@baseless/core/path";

export function generateDeclarationTypes(
	options: { exports: unknown; relativeImport: string; generateServer: boolean },
): string {
	if (!options.exports || typeof options.exports !== "object") {
		throw new Error("Invalid exports");
	}

	const exports = options.exports as Record<string, TDefinition>;

	const namedTypes = new Map<string, string>();
	const namedSchemas = new Map<string, { type: string, schema: any }>();
	function generateType(schema: any): string {
		const [map, ts] = Type.generateTypescriptFromSchema(schema);
		for (const [key, value] of map) {
			namedTypes.set(key, value);
		}
		return ts;
	}

	const decorators = Object.entries(exports).filter(([, value]) => value.type === "decoration") as [string, TDecoration<any>][];
	const requirements = Object.entries(exports).filter(([, value]) => value.type === "requirement") as [string, TRequirement<any>][];
	const collections = Object.entries(exports).filter(([, value]) => value.type === "collection") as [string, TCollection<any, any, any>][];
	const documents = Object.entries(exports).filter(([, value]) => value.type === "document") as [string, TDocument<any, any>][];
	const topics = Object.entries(exports).filter(([, value]) => value.type === "topic") as [string, TTopic<any, any>][];
	const requests = Object.entries(exports).filter(([, value]) => value.type === "on_request") as [string, TOnRequest<any, any, any>][];

	let output = `\n`;
	let header = `/// This file is auto-generated with Baseless\n`;
	header += `// deno-fmt-ignore-file\n// deno-lint-ignore-file\n\n`;

	if (options.generateServer) {
		for (const [key, definition] of collections) {
			namedTypes.set(`${key}Key`, generateType(definition.key));
			namedTypes.set(`${key}Items`, generateType(definition.items));
			namedSchemas.set(`${key}Key`, { type: Type.generateSchemaFromSchema(definition.key), schema: definition.key });
			namedSchemas.set(`${key}Items`, { type: Type.generateSchemaFromSchema(definition.items), schema: definition.items });
		}
		for (const [key, definition] of documents) {
			namedTypes.set(`${key}Data`, generateType(definition.data));
			namedSchemas.set(`${key}Data`, { type: Type.generateSchemaFromSchema(definition.data), schema: definition.data });
		}
		for (const [key, definition] of topics) {
			namedTypes.set(`${key}Message`, generateType(definition.message));
			namedSchemas.set(`${key}Message`, { type: Type.generateSchemaFromSchema(definition.message), schema: definition.message });
		}

		if (decorators.length + requirements.length > 0) {
			header += `import type { ${[...decorators, ...requirements].map(([key]) => key).join(", ")} } from "${options.relativeImport}";\n`;
		}

		header += `import type { Document, DocumentDeletingHandler, DocumentGetOptions, DocumentListEntry, DocumentListOptions, DocumentSettingHandler, ID, PathToParams, RegisteredDocumentServiceAtomic, TOnDocumentDeleting, TOnDocumentSetting, TOnTopicMessage, TopicMessageHandler } from "@baseless/server";\n`;
		header += `import { Type } from "@baseless/server";\n`;
		output += `declare module "@baseless/server" {\n`;

		// Register
		{
			const defaults = requirements.map(([key]) => `typeof ${key}["defaults"]`);
			const context = [
				...decorators.map(([key]) => `Awaited<ReturnType<typeof ${key}["handler"]>>`),
				...requirements.map(([key]) => `typeof ${key}["defaults"]`),
			];
			output += `\texport interface Register {\n`;
			output += `\t\trequirements: ${[...defaults, "{}"].join(" & ")}\n`;
			output += `\t\tcontext: ${[...context, "{}"].join(" & ")}\n`;

			const getManyData: { path: string, type: string }[] = [];
			for (const [key, value] of collections) {
				getManyData.push({ path: `\`${convertPathToTemplate(value.path)}/\${string}\``, type: `${key}Items` });
				output += `\t\tdocumentList(options: DocumentListOptions<\`${convertPathToTemplate(value.path)}\`>, signal?: AbortSignal): ReadableStream<DocumentListEntry<${key}Items>>;\n`;
				output += `\t\tdocumentGet(path: \`${convertPathToTemplate(value.path)}/\${string}\`, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Document<${key}Items>>;\n`;
				output += `\t\tdocumentAtomicCheck(key: \`${convertPathToTemplate(value.path)}/\${string}\`, versionstamp: string | null): RegisteredDocumentServiceAtomic;\n`;
				output += `\t\tdocumentAtomicSet(key: \`${convertPathToTemplate(value.path)}/\${string}\`, data: ${key}Items): RegisteredDocumentServiceAtomic;\n`;
				output += `\t\tdocumentAtomicDelete(key: \`${convertPathToTemplate(value.path)}/\${string}\`): RegisteredDocumentServiceAtomic;\n`;
			}
			for (const [key, value] of documents) {
				getManyData.push({ path: `\`${convertPathToTemplate(value.path)}\``, type: `${key}Data` });
				output += `\t\tdocumentGet(path: \`${convertPathToTemplate(value.path)}\`, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Document<${key}Data>>;\n`;
				output += `\t\tdocumentAtomicCheck(key: \`${convertPathToTemplate(value.path)}\`, versionstamp: string | null): RegisteredDocumentServiceAtomic;\n`;
				output += `\t\tdocumentAtomicSet(key: \`${convertPathToTemplate(value.path)}\`, data: ${key}Data): RegisteredDocumentServiceAtomic;\n`;
				output += `\t\tdocumentAtomicDelete(key: \`${convertPathToTemplate(value.path)}\`): RegisteredDocumentServiceAtomic;\n`;
			}
			if (getManyData.length) {
				output += `\t\tdocumentGetMany(keys: Array<${getManyData.map(d => d.path).join(" | ")}>, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Array<Document<${getManyData.map(d => d.type).join(" | ")}>>>;\n`;
			}

			for (const [key, value] of topics) {
				output += `\t\tpubSubPublish(path: \`${convertPathToTemplate(value.path)}\`, payload: ${key}Message, abortSignal?: AbortSignal): Promise<void>;\n`;
			}

			output += `\t}\n`;
		}

		// Top level API
		{
			for (const [key, value] of collections) {
				output += `\texport function onDocumentSetting(path: \`${convertPathToTemplate(value.path)}/\${string}\`, handler: DocumentSettingHandler<${convertPathToParams(value.path+"/:key")}, ${key}Items>): TOnDocumentSetting;\n`;
				output += `\texport function onDocumentDeleting(path: \`${convertPathToTemplate(value.path)}/\${string}\`, handler: DocumentDeletingHandler<${convertPathToParams(value.path+"/:key")}>): TOnDocumentDeleting;\n`;
			}
			for (const [key, value] of documents) {
				output += `\texport function onDocumentSetting(path: \`${convertPathToTemplate(value.path)}\`, handler: DocumentSettingHandler<${convertPathToParams(value.path)}, ${key}Data>): TOnDocumentSetting;\n`;
				output += `\texport function onDocumentDeleting(path: \`${convertPathToTemplate(value.path)}\`, handler: DocumentDeletingHandler<${convertPathToParams(value.path)}>): TOnDocumentDeleting;\n`;
			}
			for (const [key, value] of topics) {
				output += `\texport function onTopicMessage(path: \`${convertPathToTemplate(value.path)}\`, handler: TopicMessageHandler<${convertPathToParams(value.path)}, ${key}Message>) : TOnTopicMessage;\n`;
			}
		}

		output += `}\n`;
	} else {
		header += `import type { Document, DocumentGetOptions, DocumentListOptions, DocumentListEntry, ID, Register, RegisteredDocumentAtomic } from "@baseless/client";\n`;
		header += `import { Type } from "@baseless/client";\n`;

		for (const [key, definition] of collections) {
			if (definition.security) {
				namedTypes.set(`${key}Key`, generateType(definition.key));
				namedTypes.set(`${key}Items`, generateType(definition.items));
				namedSchemas.set(`${key}Key`, { type: Type.generateSchemaFromSchema(definition.key), schema: definition.key });
				namedSchemas.set(`${key}Items`, { type: Type.generateSchemaFromSchema(definition.items), schema: definition.items });
			}
		}
		for (const [key, definition] of documents) {
			if (definition.security) {
				namedTypes.set(`${key}Data`, generateType(definition.data));
				namedSchemas.set(`${key}Data`, { type: Type.generateSchemaFromSchema(definition.data), schema: definition.data });
			}
		}
		for (const [key, definition] of topics) {
			if (definition.security) {
				namedTypes.set(`${key}Message`, generateType(definition.message));
				namedSchemas.set(`${key}Message`, { type: Type.generateSchemaFromSchema(definition.message), schema: definition.message });
			}
		}

		for (const [key, definition] of requests) {
			if (definition.security) {
				namedTypes.set(`${key}Input`, generateType(definition.input));
				namedTypes.set(`${key}Output`, generateType(definition.output));
			}
		}

		output += `declare module "@baseless/client" {\n`;

		output += `\texport interface Register {\n`;
		for (const [key, definition] of requests) {
			if (definition.security) {
				output += `\t\trequestFetch(path: \`${convertPathToTemplate(definition.path)}\`, input: ${key}Input, abortSignal?: AbortSignal): Promise<${key}Output>;\n`;
			}
		}
		const getManyData: { path: string, type: string }[] = [];
		for (const [key, definition] of collections) {
			if (definition.security) {
				getManyData.push({ path: `\`${convertPathToTemplate(definition.path)}/\${string}\``, type: `${key}Items` });
				output += `\t\tdocumentList(options: DocumentListOptions<\`${convertPathToTemplate(definition.path)}\`>, abortSignal?: AbortSignal): ReadableStream<DocumentListEntry<${key}Items>>;\n`;
				output += `\t\tdocumentGet(path: \`${convertPathToTemplate(definition.path)}/\${string}\`, options?: DocumentGetOptions, abortSignal?: AbortSignal): Promise<Document<${key}Items>>;\n`;
				output += `\t\tdocumentAtomicCheck(path: \`${convertPathToTemplate(definition.path)}/\${string}\`, versionstamp: string | null): RegisteredDocumentAtomic;\n`;
				output += `\t\tdocumentAtomicSet(path: \`${convertPathToTemplate(definition.path)}/\${string}\`, value: ${key}Items): RegisteredDocumentAtomic;\n`;
				output += `\t\tdocumentAtomicDelete(path: \`${convertPathToTemplate(definition.path)}/\${string}\`): RegisteredDocumentAtomic;\n`;
			}
		}
		for (const [key, definition] of documents) {
			if (definition.security) {
				getManyData.push({ path: `\`${convertPathToTemplate(definition.path)}\``, type: `${key}Data` });
				output += `\t\tdocumentGet(path: \`${convertPathToTemplate(definition.path)}\`, options?: DocumentGetOptions, abortSignal?: AbortSignal): Promise<Document<${key}Data>>;\n`;
				output += `\t\tdocumentAtomicCheck(path: \`${convertPathToTemplate(definition.path)}\`, versionstamp: string | null): RegisteredDocumentAtomic;\n`;
				output += `\t\tdocumentAtomicSet(path: \`${convertPathToTemplate(definition.path)}\`, value: ${key}Data): RegisteredDocumentAtomic;\n`;
				output += `\t\tdocumentAtomicDelete(path: \`${convertPathToTemplate(definition.path)}\`): RegisteredDocumentAtomic;\n`;
			}
		}
		if (getManyData.length) {
			output += `\t\tdocumentGetMany(paths: Array<${getManyData.map(d => d.path).join(" | ")}>, options?: DocumentGetOptions, abortSignal?: AbortSignal): Promise<Array<Document<${getManyData.map(d => d.type).join(" | ")}>>>;\n`;
		}

		for (const [key, definition] of topics) {
			if (definition.security) {
				output += `\t\tpubSubPublish(path: \`${convertPathToTemplate(definition.path)}\`, payload: ${key}Message, abortSignal?: AbortSignal): Promise<void>;\n`;
				output += `\t\tpubSubSubscribe(path: \`${convertPathToTemplate(definition.path)}\`, abortSignal?: AbortSignal): ReadableStream<${key}Message>;\n`;
			}
		}
		output += `\t}\n`;

		output += `}\n`;
	}

	return [
		header,
		...namedTypes.entries().map(([key, value]) => `export type ${key} = ${value};`),
		...namedSchemas.entries().map(([key, value]) => `export const ${key} = Type.fromObject(${JSON.stringify(value.schema)}) as ${value.type};`),
		output,
	].join(`\n`);
}
