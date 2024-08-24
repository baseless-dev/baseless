// deno-lint-ignore-file no-explicit-any ban-types
import type { Static, TSchema } from "@sinclair/typebox";
import type { IDocumentAtomic, IDocumentProvider } from "../provider/document.ts";
import type { KVProvider } from "../provider/kv.ts";
import type { PathAsType, ReplaceVariableInPathSegment } from "@baseless/core/path";
import type { Document } from "@baseless/core/document";

export type Path = Array<string>;

export type Context<
	TDecoration extends {},
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
	TNewDecoration extends {},
> = (
	context: Context<any, [], []>,
) => Promise<TNewDecoration>;

export const Permission = {
	None: 0b0000000,
	All: 0b1111111,
	Execute: 0b0000001,
	Get: 0b0000010,
	Set: 0b0000100,
	Delete: 0b0001000,
	List: 0b0010000,
	Publish: 0b0100000,
	Subscribe: 0b1000000,
} as const;

export type Permission = typeof Permission[keyof typeof Permission];

export function hasPermission(mask: Permission, value: Permission): boolean {
	return (mask & value) > 0;
}

export type RpcDefinitionHandler<
	TPath extends string[],
	TDecoration extends {},
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
	TInputSchema extends TSchema,
	TOutputSchema extends TSchema,
> = (options: {
	context: Context<TDecoration, TDocument, TCollection>;
	params: PathAsType<TPath>;
	input: Static<TInputSchema>;
}) => Promise<Static<TOutputSchema>>;

export interface RpcDefinitionWithoutSecurity<
	TPath extends string[],
	TInputSchema extends TSchema,
	TOutputSchema extends TSchema,
> {
	path: TPath;
	matcher: ReplaceVariableInPathSegment<TPath>;
	input: TInputSchema;
	output: TOutputSchema;
	handler: RpcDefinitionHandler<TPath, any, [], [], TInputSchema, TOutputSchema>;
}

export type RpcDefinitionSecurity<
	TPath extends string[],
	TDecoration extends {},
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
	TInputSchema extends TSchema,
> = (options: {
	context: Context<TDecoration, TDocument, TCollection>;
	params: PathAsType<TPath>;
	input: Static<TInputSchema>;
}) => Promise<Permission>;

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
	security: RpcDefinitionSecurity<TPath, any, [], [], TInputSchema>;
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

export type EventDefinitionSecurity<
	TPath extends string[],
	TDecoration extends {},
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
	TPayloadSchema extends TSchema,
> = (options: {
	context: Context<TDecoration, TDocument, TCollection>;
	params: PathAsType<TPath>;
}) => Promise<Permission>;

export interface EventDefinitionWithSecurity<
	TPath extends string[],
	TPayloadSchema extends TSchema,
> extends EventDefinitionWithoutSecurity<TPath, TPayloadSchema> {
	security: EventDefinitionSecurity<TPath, any, [], [], TPayloadSchema>;
}

export type EventDefinition<
	TPath extends string[],
	TPayloadSchema extends TSchema,
> =
	| EventDefinitionWithoutSecurity<TPath, TPayloadSchema>
	| EventDefinitionWithSecurity<TPath, TPayloadSchema>;

export interface DocumentDefinitionWithoutSecurity<
	TPath extends string[],
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	matcher: ReplaceVariableInPathSegment<TPath>;
	schema: TDocumentSchema;
}

export type DocumentDefinitionSecurity<
	TPath extends string[],
	TDecoration extends {},
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
	TDocumentSchema extends TSchema,
> = (options: {
	context: Context<TDecoration, TDocument, TCollection>;
	params: PathAsType<TPath>;
}) => Promise<Permission>;

export interface DocumentDefinitionWithSecurity<
	TPath extends string[],
	TDocumentSchema extends TSchema,
> extends DocumentDefinitionWithoutSecurity<TPath, TDocumentSchema> {
	security: DocumentDefinitionSecurity<TPath, any, [], [], TDocumentSchema>;
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

export type CollectionDefinitionSecurity<
	TPath extends string[],
	TDecoration extends {},
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
> = (options: {
	context: Context<TDecoration, TDocument, TCollection>;
	params: PathAsType<TPath>;
}) => Promise<Permission>;

export interface CollectionDefinitionWithSecurity<
	TPath extends string[],
	TCollectionSchema extends TSchema,
> extends CollectionDefinitionWithoutSecurity<TPath, TCollectionSchema> {
	security: CollectionDefinitionSecurity<TPath, any, [], []>;
}

export type CollectionDefinition<
	TPath extends string[],
	TCollectionSchema extends TSchema,
> =
	| CollectionDefinitionWithoutSecurity<TPath, TCollectionSchema>
	| CollectionDefinitionWithSecurity<TPath, TCollectionSchema>;

export type EventListenerHandler<
	TPath extends string[],
	TDecoration extends {},
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
	TPayloadSchema extends TSchema,
> = (options: {
	context: Context<TDecoration, TDocument, TCollection>;
	params: PathAsType<TPath>;
	payload: Static<TPayloadSchema>;
}) => Promise<void>;

export interface EventListener<
	TPath extends string[],
	TPayloadSchema extends TSchema,
> {
	path: TPath;
	handler: EventListenerHandler<TPath, any, [], [], TPayloadSchema>;
}

export type DocumentAtomicSetListenerHandler<
	TPath extends string[],
	TDecoration extends {},
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
	TDocumentSchema extends TSchema,
> = (options: {
	context: Context<TDecoration, TDocument, TCollection>;
	params: PathAsType<TPath>;
	document: Document<Static<TDocumentSchema>>;
	atomic: IDocumentAtomic<TDocument, TCollection>;
}) => Promise<void>;

export interface DocumentAtomicSetListener<
	TPath extends string[],
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	handler: DocumentAtomicSetListenerHandler<TPath, any, [], [], TDocumentSchema>;
}

export type DocumentAtomicDeleteListenerHandler<
	TPath extends string[],
	TDecoration extends {},
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
	TDocumentSchema extends TSchema,
> = (options: {
	context: Context<TDecoration, TDocument, TCollection>;
	params: PathAsType<TPath>;
	atomic: IDocumentAtomic<TDocument, TCollection>;
}) => Promise<void>;

export interface DocumentAtomicDeleteListener<
	TPath extends string[],
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	handler: DocumentAtomicDeleteListenerHandler<TPath, any, [], [], TDocumentSchema>;
}

export type DocumentSetListenerHandler<
	TPath extends string[],
	TDecoration extends {},
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
	TDocumentSchema extends TSchema,
> = (options: {
	context: Context<TDecoration, TDocument, TCollection>;
	params: PathAsType<TPath>;
	document: Document<Static<TDocumentSchema>>;
}) => Promise<void>;

export interface DocumentSetListener<
	TPath extends string[],
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	handler: DocumentSetListenerHandler<TPath, any, [], [], TDocumentSchema>;
}

export type DocumentDeleteListenerHandler<
	TPath extends string[],
	TDecoration extends {},
	TDocument extends Array<DocumentDefinition<any, any>>,
	TCollection extends Array<CollectionDefinition<any, any>>,
	TDocumentSchema extends TSchema,
> = (options: {
	context: Context<TDecoration, TDocument, TCollection>;
	params: PathAsType<TPath>;
}) => Promise<void>;

export interface DocumentDeleteListener<
	TPath extends string[],
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	handler: DocumentDeleteListenerHandler<TPath, any, [], [], TDocumentSchema>;
}

export type PickAtPath<TEvent extends Array<{ path: any }>, TPath extends string[]> = {
	[K in keyof TEvent]: TPath extends ReplaceVariableInPathSegment<TEvent[K]["path"]> ? TEvent[K]
		: never;
}[number];

// deno-fmt-ignore
export type WithSecurity<T extends unknown[]> =
	T extends []
	? []
	: T extends [infer First, ...infer Rest]
		? First extends { security(...args: unknown[]): Promise<unknown> }
			? [First, ...WithSecurity<Rest>]
			: WithSecurity<Rest>
		: never;
