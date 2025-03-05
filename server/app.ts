// deno-lint-ignore-file ban-types no-explicit-any no-empty-interface
import { type Static, type TSchema, TString } from "@baseless/core/schema";
import { type PathToParams } from "@baseless/core/path";
import { AnyDocumentAtomicService, ServiceCollection } from "./service.ts";
import { ID } from "../core/id.ts";

export interface Register {}

// deno-fmt-ignore
export type RegisteredContext = Register extends { context: infer TContext extends {} } ? TContext : {};
// deno-fmt-ignore
export type RegisteredRequirements = Register extends { requirements: infer TRequirements extends {} } ? TRequirements : {};

export const Permission = {
	None: 0b0000000,
	All: 0b1111111,
	Fetch: 0b0000001,
	Get: 0b0000010,
	Set: 0b0000100,
	Delete: 0b0001000,
	List: 0b0010000,
	Publish: 0b0100000,
	Subscribe: 0b1000000,
} as const;
export type Permission = number;

export type Auth =
	| {
		identityId: ID<"id_">;
		scope: string[];
	}
	| undefined;

export type RequestHandler<TParams extends {}, TInput, TOutput> = (options: {
	auth: Auth;
	context: RegisteredContext;
	input: TInput;
	params: TParams;
	request: Request;
	service: ServiceCollection;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => TOutput | Promise<TOutput>;

export type RequestSecurityHandler<TParams extends {}, TInput> = (options: {
	context: RegisteredContext;
	input: TInput;
	params: TParams;
	request: Request;
	service: ServiceCollection;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => Permission | Promise<Permission>;

export type DocumentSettingHandler<TParams extends {}, TData> = (options: {
	auth: Auth;
	atomic: AnyDocumentAtomicService;
	context: RegisteredContext;
	document: TData;
	params: TParams;
	service: ServiceCollection;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => void | Promise<void>;

export type DocumentDeletingHandler<TParams extends {}> = (options: {
	auth: Auth;
	atomic: AnyDocumentAtomicService;
	context: RegisteredContext;
	params: TParams;
	service: ServiceCollection;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => void | Promise<void>;

export type CollectionSecurityHandler<TParams extends {}> = (options: {
	auth: Auth;
	context: RegisteredContext;
	params: TParams;
	service: ServiceCollection;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => Permission | Promise<Permission>;

export type DocumentSecurityHandler<TParams extends {}, TData> = (options: {
	auth: Auth;
	context: RegisteredContext;
	document?: TData;
	params: TParams;
	service: ServiceCollection;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => Permission | Promise<Permission>;

export type TopicMessage<TData> = {
	topic: string;
	data: TData;
	stopPropagation: boolean;
	stopImmediatePropagation: boolean;
};

export type TopicMessageHandler<TParams extends {}, TMessage> = (options: {
	auth: Auth;
	context: RegisteredContext;
	message: TopicMessage<TMessage>;
	params: TParams;
	service: ServiceCollection;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => void | Promise<void>;

export type TopicMessageSecurityHandler<TParams extends {}, TMessage> = (options: {
	auth: Auth;
	context: RegisteredContext;
	message?: TMessage;
	params: TParams;
	service: ServiceCollection;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => Permission | Promise<Permission>;

export type DecorationHandler<TDecoration extends {}> = (options: {
	auth: Auth;
	request: Request;
	service: ServiceCollection;
	signal: AbortSignal;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}) => TDecoration | Promise<TDecoration>;

export interface TCollection<TPath extends string, TKey extends TSchema, TItems extends TSchema> {
	type: "collection";
	path: TPath;
	key: TKey;
	items: TItems;
	security?: CollectionSecurityHandler<PathToParams<TPath>>;
	documentSecurity?: DocumentSecurityHandler<PathToParams<TPath>, TItems>;
}

export interface TDocument<TPath extends string, TData extends TSchema> {
	type: "document";
	path: TPath;
	data: TData;
	security?: DocumentSecurityHandler<PathToParams<TPath>, TData>;
}

export interface TTopic<TPath extends string, TTopic extends TSchema> {
	type: "topic";
	path: TPath;
	message: TTopic;
	security?: TopicMessageSecurityHandler<PathToParams<TPath>, TTopic>;
}

export interface TDecoration<TValue extends {}> {
	type: "decoration";
	handler: DecorationHandler<TValue>;
}

export interface TRequirement<TRequirements extends {}> {
	type: "requirement";
	defaults: TRequirements;
}

export interface TOnRequest<TPath extends string, TInput extends TSchema, TOutput extends TSchema> {
	type: "on_request";
	path: TPath;
	input: TInput;
	output: TOutput;
	handler: RequestHandler<PathToParams<TPath>, Static<TInput>, Static<TOutput>>;
	security?: RequestSecurityHandler<PathToParams<TPath>, Static<TInput>>;
}

export interface TOnDocumentSetting {
	type: "on_document_setting";
	path: string;
	handler: DocumentSettingHandler<any, any>;
}

export interface TOnDocumentDeleting {
	type: "on_document_deleting";
	path: string;
	handler: DocumentDeletingHandler<any>;
}

export interface TOnTopicMessage {
	type: "on_topic_message";
	path: string;
	handler: TopicMessageHandler<any, any>;
}

export type TDefinition =
	| TCollection<any, any, any>
	| TDocument<any, any>
	| TTopic<any, any>
	| TDecoration<any>
	| TRequirement<any>
	| TOnRequest<any, any, any>
	| TOnDocumentSetting
	| TOnDocumentDeleting
	| TOnTopicMessage;

export function collection<TPath extends string, TItems extends TSchema>(
	path: TPath,
	items: TItems,
	security?: CollectionSecurityHandler<PathToParams<TPath>>,
	documentSecurity?: DocumentSecurityHandler<PathToParams<TPath>, TItems>,
): TCollection<TPath, TString, TItems>;
export function collection<TPath extends string, TKey extends TSchema, TItems extends TSchema>(
	path: TPath,
	key: TKey,
	items: TItems,
	security?: CollectionSecurityHandler<PathToParams<TPath>>,
	documentSecurity?: DocumentSecurityHandler<PathToParams<TPath>, TItems>,
): TCollection<TPath, TKey, TItems>;
export function collection(
	path: string,
	keyOrItems: any,
	itemsOrSecurity?: any,
	security?: CollectionSecurityHandler<any>,
	documentSecurity?: DocumentSecurityHandler<any, any>,
): TCollection<any, any, any> {
	if (security) {
		return { type: "collection", path: path, key: keyOrItems, items: itemsOrSecurity, security, documentSecurity };
	}
	if (itemsOrSecurity) {
		return { type: "collection", path: path, key: keyOrItems, items: itemsOrSecurity };
	}
	return { type: "collection", path: path, key: String(), items: keyOrItems, security: itemsOrSecurity };
}

export function document<TPath extends string, TData extends TSchema>(
	path: TPath,
	data: TData,
	security?: DocumentSecurityHandler<PathToParams<TPath>, TData>,
): TDocument<TPath, TData> {
	return { type: "document", path: path, data, security };
}

export function topic<TPath extends string, TMessage extends TSchema>(
	path: TPath,
	message: TMessage,
	security?: TopicMessageSecurityHandler<PathToParams<TPath>, TMessage>,
): TTopic<TPath, TMessage> {
	return { type: "topic", path: path, message, security };
}

export function decorate<TValue extends {}>(
	handler: DecorationHandler<TValue>,
): TDecoration<TValue> {
	return {
		type: "decoration",
		handler,
	};
}

export function require<TRequirements extends {}>(defaults: TRequirements): TRequirement<TRequirements> {
	return {
		type: "requirement",
		defaults,
	};
}

export function onRequest<
	TPath extends string,
	TInput extends TSchema,
	TOutput extends TSchema,
>(
	path: TPath,
	input: TInput,
	output: TOutput,
	handler: RequestHandler<
		PathToParams<TPath>,
		Static<TInput>,
		Static<TOutput>
	>,
	security?: RequestSecurityHandler<PathToParams<TPath>, Static<TInput>>,
): TOnRequest<TPath, TInput, TOutput> {
	return { type: "on_request", path, input, output, handler, security };
}

export function onDocumentSetting(
	path: string,
	handler: DocumentSettingHandler<any, any>,
): TOnDocumentSetting {
	return { type: "on_document_setting", path, handler };
}

export function onDocumentDeleting(
	path: string,
	handler: DocumentDeletingHandler<any>,
): TOnDocumentDeleting {
	return { type: "on_document_deleting", path, handler };
}

export function onTopicMessage(
	path: string,
	handler: TopicMessageHandler<any, any>,
): TOnTopicMessage {
	return { type: "on_topic_message", path, handler };
}
