// deno-lint-ignore-file no-explicit-any
import { type Static, TObject, type TSchema, type TString, Type } from "@sinclair/typebox";
import { type Identity } from "@baseless/core/identity";
import { KVProvider } from "./provider.ts";
import { DocumentService } from "./service.ts";

export type Path = Array<string>;

export type Client = {
	rpc: Record<string, unknown>;
	event: Record<string, unknown>;
	document: Record<string, unknown>;
	collection: Record<string, unknown>;
};

export type Context<
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
> = {
	request: Request;
	waitUntil: (promise: PromiseLike<unknown>) => void;
	kv: KVProvider; // TODO KVService
	document: DocumentService<TDocument, TCollection>;
	// TODO event: EventService<TClient>
	// TODO storage: StorageService<TClient>
} & TDecoration;

export type Decorator<
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TNewDecoration extends Record<string, unknown>,
> = (
	context: Context<TDecoration, TDocument, TCollection>,
) => Promise<TNewDecoration>;

export interface RpcDefinitionWithoutSecurity<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TInput extends TSchema,
	TOutput extends TSchema,
> {
	path: TPath;
	matcher: ReplaceVariableInPathSegment<TPath>;
	input: TInput;
	output: TOutput;
	handler: (options: {
		context: Context<TDecoration, TDocument, TCollection>;
		params: PathAsType<TPath>;
		input: Static<TInput>;
	}) => Promise<Static<TOutput>>;
}

export interface RpcDefinitionWithSecurity<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TInput extends TSchema,
	TOutput extends TSchema,
> extends
	RpcDefinitionWithoutSecurity<TPath, TDecoration, TDocument, TCollection, TInput, TOutput> {
	security: (options: {
		context: Context<TDecoration, TDocument, TCollection>;
		params: PathAsType<TPath>;
	}) => Promise<"allow" | "deny" | undefined>;
}

export type RpcDefinition<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TInput extends TSchema,
	TOutput extends TSchema,
> =
	| RpcDefinitionWithoutSecurity<TPath, TDecoration, TDocument, TCollection, TInput, TOutput>
	| RpcDefinitionWithSecurity<TPath, TDecoration, TDocument, TCollection, TInput, TOutput>;

export interface EventDefinitionWithoutSecurity<
	TPath extends string[],
	TPayloadSchema extends TSchema,
> {
	path: TPath;
	matcher: ReplaceVariableInPathSegment<TPath>;
	payload: TPayloadSchema;
}

export interface EventDefinitionWithSecurity<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TPayloadSchema extends TSchema,
> extends EventDefinitionWithoutSecurity<TPath, TPayloadSchema> {
	security: (options: {
		context: Context<TDecoration, TDocument, TCollection>;
		params: PathAsType<TPath>;
	}) => Promise<"subscribe" | "publish" | undefined>;
}

export type EventDefinition<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TPayloadSchema extends TSchema,
> =
	| EventDefinitionWithoutSecurity<TPath, TPayloadSchema>
	| EventDefinitionWithSecurity<TPath, TDecoration, TDocument, TCollection, TPayloadSchema>;

// deno-fmt-ignore
export type EventDefinitionHasSecurity<TDefinition> =
	TDefinition extends EventDefinitionWithSecurity<any, any, any, any, any>
	? TDefinition
	: never;

export interface DocumentDefinitionWithoutSecurity<
	TPath extends string[],
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	matcher: ReplaceVariableInPathSegment<TPath>;
	schema: TDocumentSchema;
}

export interface DocumentDefinitionWithSecurity<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TDocumentSchema extends TSchema,
> extends DocumentDefinitionWithoutSecurity<TPath, TDocumentSchema> {
	security: (options: {
		context: Context<TDecoration, TDocument, TCollection>;
		params: PathAsType<TPath>;
	}) => Promise<"subscribe" | "read" | "update" | "delete" | undefined>;
}

export type DocumentDefinition<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TDocumentSchema extends TSchema,
> =
	| DocumentDefinitionWithoutSecurity<TPath, TDocumentSchema>
	| DocumentDefinitionWithSecurity<TPath, TDecoration, TDocument, TCollection, TDocumentSchema>;

// deno-fmt-ignore
export type DocumentDefinitionHasSecurity<TDefinition> =
	TDefinition extends DocumentDefinitionWithSecurity<any, any, any, any, any>
	? TDefinition
	: never;

export interface CollectionDefinitionWithoutSecurity<
	TPath extends string[],
	TCollectionSchema extends TSchema,
> {
	path: TPath;
	matcher: ReplaceVariableInPathSegment<TPath>;
	schema: TCollectionSchema;
}

export interface CollectionDefinitionWithSecurity<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TCollectionSchema extends TSchema,
> extends CollectionDefinitionWithoutSecurity<TPath, TCollectionSchema> {
	security: (options: {
		context: Context<TDecoration, TDocument, TCollection>;
		params: PathAsType<TPath>;
	}) => Promise<
		| "subscribe"
		| "list"
		| "create"
		| "read"
		| "update"
		| "delete"
		| undefined
	>;
}

export type CollectionDefinition<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TCollectionSchema extends TSchema,
> =
	| CollectionDefinitionWithoutSecurity<TPath, TCollectionSchema>
	| CollectionDefinitionWithSecurity<
		TPath,
		TDecoration,
		TDocument,
		TCollection,
		TCollectionSchema
	>;

export interface EventListener<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TPayloadSchema extends TSchema,
> {
	path: TPath;
	handler: (options: {
		context: Context<TDecoration, TDocument, TCollection>;
		params: PathAsType<TPath>;
		payload: Static<TPayloadSchema>;
	}) => Promise<void>;
}

export interface DocumentAtomicListener<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	handler: (options: {
		context: Context<TDecoration, TDocument, TCollection>;
		params: PathAsType<TPath>;
		document: Static<TDocumentSchema>;
		atomic: unknown;
	}) => Promise<void>;
}

export interface DocumentListener<
	TPath extends string[],
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	handler: (options: {
		context: Context<TDecoration, TDocument, TCollection>;
		params: PathAsType<TPath>;
		document: Static<TDocumentSchema>;
	}) => Promise<void>;
}

export interface IdentityListener<
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any, any, any, any>>,
	TCollection extends Array<CollectionDefinition<any, any, any, any, any>>,
> {
	handler: (
		context: Context<TDecoration, TDocument, TCollection>,
		identity: Identity,
	) => Promise<void>;
}

export type PickAtPath<TEvent extends Array<{ path: any }>, TPath extends string[]> = {
	[K in keyof TEvent]: TPath extends ReplaceVariableInPathSegment<TEvent[K]["path"]> ? TEvent[K]
		: never;
}[number];

export type ReplaceVariableInPathSegment<TPath extends string[]> =
	& {
		[K in keyof TPath]: TPath[K] extends `{${string}}` ? `${string}` : TPath[K];
	}
	& { length: TPath["length"] };

export type ExtractParamInPath<TPath extends string[]> = {
	[K in keyof TPath]: TPath[K] extends `{${infer Name}}` ? Name : never;
};

// deno-fmt-ignore
export type PathAsString<TPath extends string[]> =
	TPath extends [infer Head]
	? Head extends string
		? Head extends `{${string}}`
			? `%`
			: Head
		: ""
	: TPath extends [infer Head, ...infer Tail]
		? Head extends string
			? Tail extends string[]
				? Head extends `{${string}}`
					? `%/${PathAsString<Tail>}`
					: `${Head}/${PathAsString<Tail>}`
				: ""
			: ""
		: "";

export type PathAsType<TPath extends string[]> = {
	[param in ExtractParamInPath<TPath>[number]]: string;
};

export type PathAsSchema<TPath extends string[]> = TObject<
	{
		[param in ExtractParamInPath<TPath>[number]]: TString;
	}
>;

export function PathAsSchema<const TPath extends string[]>(path: TPath): PathAsSchema<TPath> {
	const props: Record<string, TString> = {};
	for (const segment of path) {
		if (segment.startsWith("{") && segment.endsWith("}")) {
			props[segment.slice(1, -1)] = Type.String();
		}
	}
	return Type.Object(props) as never;
}

// deno-fmt-ignore
type _PathAsObject<TPath extends any[], T> = 
	TPath extends []
		? T
		: TPath extends [infer Head]
			? Head extends `{${string}}`
				? Record<string, T>
				: Head extends string
					? { [K in Head]: T }
					: never
			: TPath extends [infer Head, ...infer Tail]
				? Head extends `{${string}}`
					? Record<string, _PathAsObject<Tail, T>>
					: Head extends string
						? { [K in Head]: _PathAsObject<Tail, T> }
						: never
				: never;

export type PathAsObject<T extends { path: string[] }> = _PathAsObject<T["path"], T>;

export type PathMatcher<T> = (path: string[]) => T | undefined;
