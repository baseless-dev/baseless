// deno-lint-ignore-file no-explicit-any
import type { Static, TSchema } from "@sinclair/typebox";
import type { Identity } from "@baseless/core/identity";
import type { IDocumentAtomic, IDocumentProvider, KVProvider } from "./provider.ts";
import type { PathAsType, ReplaceVariableInPathSegment } from "@baseless/core/path";
import type { Document } from "@baseless/core/document";

export type Path = Array<string>;

export type Client = {
	rpc: Record<string, unknown>;
	event: Record<string, unknown>;
	document: Record<string, unknown>;
	collection: Record<string, unknown>;
};

export type Context<
	TDecoration extends Record<string, unknown>,
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
> = {
	request: Request;
	waitUntil: (promise: PromiseLike<unknown>) => void;
	kv: KVProvider; // TODO KVService
	document: IDocumentProvider<TDocument, TCollection>;
	// TODO event: EventService<TClient>
	// TODO storage: StorageService<TClient>
} & TDecoration;

export type Decorator<
	TNewDecoration extends Record<string, unknown>,
> = (
	context: Context<any, [], []>,
) => Promise<TNewDecoration>;

export interface RpcDefinitionWithoutSecurity<
	TPath extends string[],
	TInputSchema extends TSchema,
	TOutputSchema extends TSchema,
> {
	path: TPath;
	matcher: ReplaceVariableInPathSegment<TPath>;
	input: TInputSchema;
	output: TOutputSchema;
	handler: (options: {
		context: Context<any, [], []>;
		params: PathAsType<TPath>;
		input: Static<TInputSchema>;
	}) => Promise<Static<TOutputSchema>>;
}

export interface RpcDefinitionWithSecurity<
	TPath extends string[],
	TInputSchema extends TSchema,
	TOutputSchema extends TSchema,
> extends
	RpcDefinitionWithoutSecurity<
		TPath,
		TInputSchema,
		TOutputSchema
	> {
	security: (options: {
		context: Context<any, [], []>;
		params: PathAsType<TPath>;
		input: Static<TInputSchema>;
	}) => Promise<"allow" | "deny" | undefined>;
}

export type RpcDefinition<
	TPath extends string[],
	TInputSchema extends TSchema,
	TOutputSchema extends TSchema,
> =
	| RpcDefinitionWithoutSecurity<TPath, TInputSchema, TOutputSchema>
	| RpcDefinitionWithSecurity<TPath, TInputSchema, TOutputSchema>;

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
	TPayloadSchema extends TSchema,
> extends EventDefinitionWithoutSecurity<TPath, TPayloadSchema> {
	security: (options: {
		context: Context<any, [], []>;
		params: PathAsType<TPath>;
		payload: Static<TPayloadSchema>;
	}) => Promise<"subscribe" | "publish" | undefined>;
}

export type EventDefinition<
	TPath extends string[],
	TPayloadSchema extends TSchema,
> =
	| EventDefinitionWithoutSecurity<TPath, TPayloadSchema>
	| EventDefinitionWithSecurity<TPath, TPayloadSchema>;

// deno-fmt-ignore
export type EventDefinitionHasSecurity<TDefinition> =
	TDefinition extends EventDefinitionWithSecurity<any, any>
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
	TDocumentSchema extends TSchema,
> extends DocumentDefinitionWithoutSecurity<TPath, TDocumentSchema> {
	security: (options: {
		context: Context<any, [], []>;
		params: PathAsType<TPath>;
		document: Document<Static<TDocumentSchema>>;
	}) => Promise<"subscribe" | "get" | "set" | "delete" | undefined>;
}

export type DocumentDefinition<
	TPath extends string[],
	TDocumentSchema extends TSchema,
> =
	| DocumentDefinitionWithoutSecurity<TPath, TDocumentSchema>
	| DocumentDefinitionWithSecurity<TPath, TDocumentSchema>;

// deno-fmt-ignore
export type DocumentDefinitionHasSecurity<TDefinition> =
	TDefinition extends DocumentDefinitionWithSecurity<any, any>
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
	TCollectionSchema extends TSchema,
> extends CollectionDefinitionWithoutSecurity<TPath, TCollectionSchema> {
	security: (options: {
		context: Context<any, [], []>;
		params: PathAsType<TPath>;
		key: ReplaceVariableInPathSegment<TPath>;
	}) => Promise<"list" | undefined>;
}

export type CollectionDefinition<
	TPath extends string[],
	TCollectionSchema extends TSchema,
> =
	| CollectionDefinitionWithoutSecurity<TPath, TCollectionSchema>
	| CollectionDefinitionWithSecurity<TPath, TCollectionSchema>;

export interface EventListener<
	TPath extends string[],
	TPayloadSchema extends TSchema,
> {
	path: TPath;
	handler: (options: {
		context: Context<any, [], []>;
		params: PathAsType<TPath>;
		payload: Static<TPayloadSchema>;
	}) => Promise<void>;
}

export interface DocumentAtomicListener<
	TPath extends string[],
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	handler: (options: {
		context: Context<any, [], []>;
		params: PathAsType<TPath>;
		document: Static<TDocumentSchema>;
		atomic: IDocumentAtomic<[], []>;
	}) => Promise<void>;
}

export interface DocumentListener<
	TPath extends string[],
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	handler: (options: {
		context: Context<any, [], []>;
		params: PathAsType<TPath>;
		document: Document<Static<TDocumentSchema>>;
	}) => Promise<void>;
}

export interface IdentityListener {
	handler: (
		context: Context<any, [], []>,
		identity: Identity,
	) => Promise<void>;
}

export type PickAtPath<TEvent extends Array<{ path: any }>, TPath extends string[]> = {
	[K in keyof TEvent]: TPath extends ReplaceVariableInPathSegment<TEvent[K]["path"]> ? TEvent[K]
		: never;
}[number];
