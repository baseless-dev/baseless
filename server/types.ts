import { type Static, type TSchema, TVoid } from "@sinclair/typebox";
import { type Identity } from "@baseless/core/identity";

export type Path = Array<string>;

export type Context<TDecoration> = {
	request: Request;
} & TDecoration;

export type Decorator<TDecoration, TNewDecoration> = (
	context: Context<TDecoration>,
) => Promise<TNewDecoration>;

export interface RpcDefinitionWithoutSecurity<
	TPath,
	TDecoration,
	TInput extends TSchema,
	TOutput extends TSchema,
> {
	path: TPath;
	input: TInput;
	output: TOutput;
	handler: (options: {
		context: Context<TDecoration>;
		input: Static<TInput>;
	}) => Promise<Static<TOutput>>;
}

export interface RpcDefinitionWithSecurity<
	TPath,
	TDecoration,
	TInput extends TSchema,
	TOutput extends TSchema,
> extends RpcDefinitionWithoutSecurity<TPath, TDecoration, TInput, TOutput> {
	security: (options: { context: Context<TDecoration> }) => "allow" | "deny" | undefined;
}

export type RpcDefinition<
	TPath,
	TDecoration,
	TInput extends TSchema,
	TOutput extends TSchema,
> =
	| RpcDefinitionWithoutSecurity<TPath, TDecoration, TInput, TOutput>
	| RpcDefinitionWithSecurity<TPath, TDecoration, TInput, TOutput>;

// deno-fmt-ignore
export type RpcDefinitionHasSecurity<TDefinition> =
	TDefinition extends RpcDefinitionWithSecurity<any, any, any, any>
	? TDefinition
	: never;

// deno-fmt-ignore
export type RpcDefinitionIsInputVoid<TDefinition> =
	TDefinition extends RpcDefinition<any, any, infer I, any>
	? I extends TVoid
		? TDefinition
		: never
	: never;

// deno-fmt-ignore
export type RpcDefinitionIsInputNonVoid<TDefinition> =
	TDefinition extends RpcDefinition<any, any, infer I, any>
	? I extends TVoid
		? never
		: TDefinition
	: never;

export interface EventDefinitionWithoutSecurity<
	TPath,
	TPayloadSchema extends TSchema,
> {
	path: TPath;
	payload: TPayloadSchema;
}

export interface EventDefinitionWithSecurity<
	TPath,
	TDecoration,
	TPayloadSchema extends TSchema,
> extends EventDefinitionWithoutSecurity<TPath, TPayloadSchema> {
	security: (options: { context: Context<TDecoration> }) => "subscribe" | "publish" | undefined;
}

export type EventDefinition<TPath, TDecoration, TPayloadSchema extends TSchema> =
	| EventDefinitionWithoutSecurity<TPath, TPayloadSchema>
	| EventDefinitionWithSecurity<TPath, TDecoration, TPayloadSchema>;

// deno-fmt-ignore
export type EventDefinitionHasSecurity<TDefinition> =
	TDefinition extends EventDefinitionWithSecurity<any, any, any>
	? TDefinition
	: never;

// deno-fmt-ignore
export type EventDefinitionIsPayloadVoid<TDefinition> =
	TDefinition extends EventDefinition<any, any, infer S>
	? S extends TVoid
		? TDefinition
		: never
	: never;

// deno-fmt-ignore
export type RpcDefinitionIsPayloadNonVoid<TDefinition> =
	TDefinition extends EventDefinition<any, any, infer S>
	? S extends TVoid
		? never
		: TDefinition
	: never;

export interface DocumentDefinitionWithoutSecurity<
	TPath,
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	schema: TDocumentSchema;
}

export interface DocumentDefinitionWithSecurity<
	TPath,
	TDecoration,
	TDocumentSchema extends TSchema,
> extends DocumentDefinitionWithoutSecurity<TPath, TDocumentSchema> {
	security: (
		options: { context: Context<TDecoration> },
	) => "subscribe" | "read" | "update" | "delete" | undefined;
}

export type DocumentDefinition<TPath, TDecoration, TDocumentSchema extends TSchema> =
	| DocumentDefinitionWithoutSecurity<TPath, TDocumentSchema>
	| DocumentDefinitionWithSecurity<TPath, TDecoration, TDocumentSchema>;

// deno-fmt-ignore
export type DocumentDefinitionHasSecurity<TDefinition> =
	TDefinition extends DocumentDefinitionWithSecurity<any, any, any>
	? TDefinition
	: never;

export interface CollectionDefinitionWithoutSecurity<
	TPath,
	TCollectionSchema extends TSchema,
> {
	path: TPath;
	schema: TCollectionSchema;
}

export interface CollectionDefinitionWithSecurity<
	TPath,
	TDecoration,
	TCollectionSchema extends TSchema,
> extends CollectionDefinitionWithoutSecurity<TPath, TCollectionSchema> {
	security: (
		options: { context: Context<TDecoration> },
	) =>
		| "subscribe"
		| "list"
		| "create"
		| "read"
		| "update"
		| "delete"
		| undefined;
}

export type CollectionDefinition<TPath, TContext, TCollectionSchema extends TSchema> =
	| CollectionDefinitionWithoutSecurity<TPath, TCollectionSchema>
	| CollectionDefinitionWithSecurity<TPath, TContext, TCollectionSchema>;

// deno-fmt-ignore
export type CollectionDefinitionHasSecurity<TDefinition> =
	TDefinition extends CollectionDefinitionWithSecurity<any, any, any>
	? TDefinition
	: never;

export interface EventListener<TPath, TDecoration, TPayloadSchema extends TSchema> {
	path: TPath;
	handler: (options: {
		context: Context<TDecoration>;
		payload: Static<TPayloadSchema>;
	}) => Promise<void>;
}

export interface DocumentAtomicListener<TPath, TDecoration, TDocumentSchema extends TSchema> {
	path: TPath;
	handler: (options: {
		context: Context<TDecoration>;
		document: Static<TDocumentSchema>;
		atomic: unknown;
	}) => Promise<void>;
}

export interface DocumentListener<TPath, TDecoration, TDocumentSchema extends TSchema> {
	path: TPath;
	handler: (options: {
		context: Context<TDecoration>;
		document: Static<TDocumentSchema>;
	}) => Promise<void>;
}

export interface IdentityListener<TDecoration> {
	handler: (
		context: Context<TDecoration>,
		identity: Identity,
	) => Promise<void>;
}

export type PickAtPath<TEvent extends Array<{ path: any }>, Path> = {
	[K in keyof TEvent]: TEvent[K]["path"] extends Path ? TEvent[K] : never;
}[number];

export type ReplaceVariableInPathSegment<TPath extends string[]> = {
	[K in keyof TPath]: TPath[K] extends `{${string}}` ? `${string}` : TPath[K];
};
