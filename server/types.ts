import {
	type Static,
	TObject,
	type TSchema,
	type TString,
	type TVoid,
	Type,
} from "@sinclair/typebox";
import { type Identity } from "@baseless/core/identity";
import { DocumentProvider, KVProvider } from "./provider.ts";

export type Path = Array<string>;

export type Context<TDecoration> = {
	request: Request;
	waitUntil: (promise: PromiseLike<unknown>) => void;
	kv: KVProvider; // TODO KVService
	document: DocumentProvider; // TODO DocumentService<TDocument | TCollection>
	// TODO event: EventService<TEvent>
	// TODO storage: StorageService<TFile | TFolder>
} & TDecoration;

export type Decorator<TDecoration, TNewDecoration> = (
	context: Context<TDecoration>,
) => Promise<TNewDecoration>;

export interface RpcDefinitionWithoutSecurity<
	TPath extends string[],
	TDecoration extends {},
	TInput extends TSchema,
	TOutput extends TSchema,
> {
	path: TPath;
	input: TInput;
	output: TOutput;
	handler: (options: {
		context: Context<TDecoration>;
		params: PathAsType<TPath>;
		input: Static<TInput>;
	}) => Promise<Static<TOutput>>;
}

export interface RpcDefinitionWithSecurity<
	TPath extends string[],
	TDecoration extends {},
	TInput extends TSchema,
	TOutput extends TSchema,
> extends RpcDefinitionWithoutSecurity<TPath, TDecoration, TInput, TOutput> {
	security: (options: {
		context: Context<TDecoration>;
		params: PathAsType<TPath>;
	}) => Promise<"allow" | "deny" | undefined>;
}

export type RpcDefinition<
	TPath extends string[],
	TDecoration extends {},
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
	TPath extends string[],
	TPayloadSchema extends TSchema,
> {
	path: TPath;
	payload: TPayloadSchema;
}

export interface EventDefinitionWithSecurity<
	TPath extends string[],
	TDecoration extends {},
	TPayloadSchema extends TSchema,
> extends EventDefinitionWithoutSecurity<TPath, TPayloadSchema> {
	security: (options: {
		context: Context<TDecoration>;
		params: PathAsType<TPath>;
	}) => Promise<"subscribe" | "publish" | undefined>;
}

export type EventDefinition<
	TPath extends string[],
	TDecoration extends {},
	TPayloadSchema extends TSchema,
> =
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
	TPath extends string[],
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	schema: TDocumentSchema;
}

export interface DocumentDefinitionWithSecurity<
	TPath extends string[],
	TDecoration extends {},
	TDocumentSchema extends TSchema,
> extends DocumentDefinitionWithoutSecurity<TPath, TDocumentSchema> {
	security: (options: {
		context: Context<TDecoration>;
		params: PathAsType<TPath>;
	}) => Promise<"subscribe" | "read" | "update" | "delete" | undefined>;
}

export type DocumentDefinition<
	TPath extends string[],
	TDecoration extends {},
	TDocumentSchema extends TSchema,
> =
	| DocumentDefinitionWithoutSecurity<TPath, TDocumentSchema>
	| DocumentDefinitionWithSecurity<TPath, TDecoration, TDocumentSchema>;

// deno-fmt-ignore
export type DocumentDefinitionHasSecurity<TDefinition> =
	TDefinition extends DocumentDefinitionWithSecurity<any, any, any>
	? TDefinition
	: never;

export interface CollectionDefinitionWithoutSecurity<
	TPath extends string[],
	TCollectionSchema extends TSchema,
> {
	path: TPath;
	schema: TCollectionSchema;
}

export interface CollectionDefinitionWithSecurity<
	TPath extends string[],
	TDecoration extends {},
	TCollectionSchema extends TSchema,
> extends CollectionDefinitionWithoutSecurity<TPath, TCollectionSchema> {
	security: (options: {
		context: Context<TDecoration>;
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
	TContext extends {},
	TCollectionSchema extends TSchema,
> =
	| CollectionDefinitionWithoutSecurity<TPath, TCollectionSchema>
	| CollectionDefinitionWithSecurity<TPath, TContext, TCollectionSchema>;

// deno-fmt-ignore
export type CollectionDefinitionHasSecurity<TDefinition> =
	TDefinition extends CollectionDefinitionWithSecurity<any, any, any>
	? TDefinition
	: never;

export interface EventListener<
	TPath extends string[],
	TDecoration extends {},
	TPayloadSchema extends TSchema,
> {
	path: TPath;
	handler: (options: {
		context: Context<TDecoration>;
		params: PathAsType<TPath>;
		payload: Static<TPayloadSchema>;
	}) => Promise<void>;
}

export interface DocumentAtomicListener<
	TPath extends string[],
	TDecoration extends {},
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	handler: (options: {
		context: Context<TDecoration>;
		params: PathAsType<TPath>;
		document: Static<TDocumentSchema>;
		atomic: unknown;
	}) => Promise<void>;
}

export interface DocumentListener<
	TPath extends string[],
	TDecoration extends {},
	TDocumentSchema extends TSchema,
> {
	path: TPath;
	handler: (options: {
		context: Context<TDecoration>;
		params: PathAsType<TPath>;
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

export type ExtractParamInPath<TPath extends string[]> = {
	[K in keyof TPath]: TPath[K] extends `{${infer Name}}` ? Name : never;
};

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
