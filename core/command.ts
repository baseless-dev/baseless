import {
	type TArray,
	type TLiteral,
	type TNumber,
	type TObject,
	type TOptional,
	type TRecursive,
	type TString,
	type TThis,
	type TUnion,
	type TUnknown,
	Type,
} from "@sinclair/typebox";

export interface CommandRpcInvoke {
	kind: "command:rpc:invoke";
	rpc: string[];
	input: unknown;
}

export const CommandRpcInvoke: TObject<{
	kind: TLiteral<"command:rpc:invoke">;
	rpc: TArray<TString>;
	input: TUnknown;
}> = Type.Object({
	kind: Type.Literal("command:rpc:invoke"),
	rpc: Type.Array(Type.String()),
	input: Type.Unknown(),
}, { $id: "CommandRpcInvoke" });

export function isCommandRpcInvoke(value: unknown): value is CommandRpcInvoke {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:rpc:invoke" &&
		"rpc" in value && Array.isArray(value.rpc);
}

export interface CommandEventSubscribe {
	kind: "command:event:subscribe";
	event: string[];
}

export const CommandEventSubscribe: TObject<{
	kind: TLiteral<"command:event:subscribe">;
	event: TArray<TString>;
}> = Type.Object({
	kind: Type.Literal("command:event:subscribe"),
	event: Type.Array(Type.String()),
}, { $id: "CommandEventSubscribe" });

export function isCommandEventSubscribe(value: unknown): value is CommandEventSubscribe {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:event:subscribe" && "event" in value && Array.isArray(value.event);
}

export interface CommandEventUnsubscribe {
	kind: "command:event:unsubscribe";
	event: string[];
}

export const CommandEventUnsubscribe: TObject<{
	kind: TLiteral<"command:event:unsubscribe">;
	event: TArray<TString>;
}> = Type.Object({
	kind: Type.Literal("command:event:unsubscribe"),
	event: Type.Array(Type.String()),
}, { $id: "CommandEventUnsubscribe" });

export function isCommandEventUnsubscribe(value: unknown): value is CommandEventUnsubscribe {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:event:unsubscribe" && "event" in value &&
		Array.isArray(value.event);
}

export interface CommandDocumentGet {
	kind: "command:document:get";
	document: string[];
}

export const CommandDocumentGet: TObject<{
	kind: TLiteral<"command:document:get">;
	document: TArray<TString>;
}> = Type.Object({
	kind: Type.Literal("command:document:get"),
	document: Type.Array(Type.String()),
}, { $id: "CommandDocumentGet" });

export function isCommandDocumentGet(value: unknown): value is CommandDocumentGet {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:document:get" && "document" in value &&
		Array.isArray(value.document);
}

export interface CommandDocumentSet {
	kind: "command:document:set";
	document: string[];
	value: unknown;
}

export const CommandDocumentSet: TObject<{
	kind: TLiteral<"command:document:set">;
	document: TArray<TString>;
	value: TUnknown;
}> = Type.Object({
	kind: Type.Literal("command:document:set"),
	document: Type.Array(Type.String()),
	value: Type.Unknown(),
}, { $id: "CommandDocumentSet" });

export function isCommandDocumentSet(value: unknown): value is CommandDocumentSet {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:document:set" && "document" in value &&
		Array.isArray(value.document) &&
		"value" in value;
}

export interface CommandDocumentDelete {
	kind: "command:document:delete";
	document: string[];
}

export const CommandDocumentDelete: TObject<{
	kind: TLiteral<"command:document:delete">;
	document: TArray<TString>;
}> = Type.Object({
	kind: Type.Literal("command:document:delete"),
	document: Type.Array(Type.String()),
}, { $id: "CommandDocumentDelete" });

export function isCommandDocumentDelete(value: unknown): value is CommandDocumentDelete {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:document:delete" && "document" in value &&
		Array.isArray(value.document);
}

export interface CommandCollectionList {
	kind: "command:collection:list";
	collection: string[];
	limit?: number;
	cursor?: string;
}

export const CommandCollectionList: TObject<{
	kind: TLiteral<"command:collection:list">;
	collection: TArray<TString>;
	limit: TOptional<TNumber>;
	cursor: TOptional<TString>;
}> = Type.Object({
	kind: Type.Literal("command:collection:list"),
	collection: Type.Array(Type.String()),
	limit: Type.Optional(Type.Number()),
	cursor: Type.Optional(Type.String()),
}, { $id: "CommandCollectionList" });

export function isCommandCollectionList(value: unknown): value is CommandCollectionList {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:collection:list" && "collection" in value &&
		Array.isArray(value.collection);
}

export interface CommandCollectionGet {
	kind: "command:collection:get";
	collection: string[];
	id: string;
}

export const CommandCollectionGet: TObject<{
	kind: TLiteral<"command:collection:get">;
	collection: TArray<TString>;
	id: TString;
}> = Type.Object({
	kind: Type.Literal("command:collection:get"),
	collection: Type.Array(Type.String()),
	id: Type.String(),
}, { $id: "CommandCollectionGet" });

export function isCommandCollectionGet(value: unknown): value is CommandCollectionGet {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:collection:get" && "collection" in value &&
		Array.isArray(value.collection) && "id" in value;
}

export interface CommandCollectionCreate {
	kind: "command:collection:create";
	collection: string[];
	value: unknown;
}

export const CommandCollectionCreate: TObject<{
	kind: TLiteral<"command:collection:create">;
	collection: TArray<TString>;
	value: TUnknown;
}> = Type.Object({
	kind: Type.Literal("command:collection:create"),
	collection: Type.Array(Type.String()),
	value: Type.Unknown(),
}, { $id: "CommandCollectionCreate" });

export function isCommandCollectionCreate(value: unknown): value is CommandCollectionCreate {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:collection:create" && "collection" in value &&
		Array.isArray(value.collection) && "value" in value;
}

export interface CommandCollectionUpdate {
	kind: "command:collection:update";
	collection: string[];
	id: string;
	value: unknown;
}

export const CommandCollectionUpdate: TObject<{
	kind: TLiteral<"command:collection:update">;
	collection: TArray<TString>;
	id: TString;
	value: TUnknown;
}> = Type.Object({
	kind: Type.Literal("command:collection:update"),
	collection: Type.Array(Type.String()),
	id: Type.String(),
	value: Type.Unknown(),
}, { $id: "CommandCollectionUpdate" });

export function isCommandCollectionUpdate(value: unknown): value is CommandCollectionUpdate {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:collection:update" && "collection" in value &&
		Array.isArray(value.collection) && "id" in value && "value" in value;
}

export interface CommandCollectionDelete {
	kind: "command:collection:delete";
	collection: string[];
	id: string;
}

export const CommandCollectionDelete: TObject<{
	kind: TLiteral<"command:collection:delete">;
	collection: TArray<TString>;
	id: TString;
}> = Type.Object({
	kind: Type.Literal("command:collection:delete"),
	collection: Type.Array(Type.String()),
	id: Type.String(),
}, { $id: "CommandCollectionDelete" });

export function isCommandCollectionDelete(value: unknown): value is CommandCollectionDelete {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:collection:delete" && "collection" in value &&
		Array.isArray(value.collection) && "id" in value;
}

export type CommandDocumentAtomicOperation =
	| { kind: "match"; document: string[]; version: string }
	| { kind: "exists"; document: string[] }
	| { kind: "notExists"; document: string[] }
	| { kind: "set"; document: string[]; value: unknown }
	| { kind: "delete"; document: string[] };

export const CommandDocumentAtomicOperation: TUnion<[
	TObject<{
		kind: TLiteral<"match">;
		document: TArray<TString>;
		version: TString;
	}>,
	TObject<{
		kind: TLiteral<"exists">;
		document: TArray<TString>;
	}>,
	TObject<{
		kind: TLiteral<"notExists">;
		document: TArray<TString>;
	}>,
	TObject<{
		kind: TLiteral<"set">;
		document: TArray<TString>;
		value: TUnknown;
	}>,
	TObject<{
		kind: TLiteral<"delete">;
		document: TArray<TString>;
	}>,
]> = Type.Union([
	Type.Object({
		kind: Type.Literal("match"),
		document: Type.Array(Type.String()),
		version: Type.String(),
	}),
	Type.Object({
		kind: Type.Literal("exists"),
		document: Type.Array(Type.String()),
	}),
	Type.Object({
		kind: Type.Literal("notExists"),
		document: Type.Array(Type.String()),
	}),
	Type.Object({
		kind: Type.Literal("set"),
		document: Type.Array(Type.String()),
		value: Type.Unknown(),
	}),
	Type.Object({
		kind: Type.Literal("delete"),
		document: Type.Array(Type.String()),
	}),
], { $id: "CommandDocumentAtomicOperation" });

export function isCommandDocumentAtomicOperation(
	value: unknown,
): value is CommandDocumentAtomicOperation {
	return !!value && typeof value === "object" && "kind" in value &&
		(
			(value.kind === "match" && "document" in value && Array.isArray(value.document) &&
				"version" in value && typeof value.version === "string") ||
			(value.kind === "exists" && "document" in value && Array.isArray(value.document)) ||
			(value.kind === "notExists" && "document" in value && Array.isArray(value.document)) ||
			(value.kind === "set" && "document" in value && Array.isArray(value.document) &&
				"value" in value) ||
			(value.kind === "delete" && "document" in value && Array.isArray(value.document))
		);
}

export interface CommandDocumentAtomic {
	kind: "command:document:atomic";
	operations: CommandDocumentAtomicOperation[];
}

export const CommandDocumentAtomic: TObject<{
	kind: TLiteral<"command:document:atomic">;
	operations: TArray<typeof CommandDocumentAtomicOperation>;
}> = Type.Object({
	kind: Type.Literal("command:document:atomic"),
	operations: Type.Array(CommandDocumentAtomicOperation),
}, { $id: "CommandDocumentAtomic" });

export function isCommandDocumentAtomic(value: unknown): value is CommandDocumentAtomic {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:document:atomic" && "operations" in value &&
		Array.isArray(value.operations) &&
		value.operations.every((operation) => isCommandDocumentAtomicOperation(operation));
}

export type Command =
	| CommandRpcInvoke
	| CommandEventSubscribe
	| CommandEventUnsubscribe
	| CommandDocumentGet
	| CommandDocumentSet
	| CommandDocumentDelete
	| CommandCollectionList
	| CommandCollectionGet
	| CommandCollectionCreate
	| CommandCollectionUpdate
	| CommandCollectionDelete
	| CommandDocumentAtomic
	| CommandBatched;

export const Command: TRecursive<
	TUnion<[
		typeof CommandRpcInvoke,
		typeof CommandEventSubscribe,
		typeof CommandEventUnsubscribe,
		typeof CommandDocumentGet,
		typeof CommandDocumentSet,
		typeof CommandDocumentDelete,
		typeof CommandCollectionList,
		typeof CommandCollectionGet,
		typeof CommandCollectionCreate,
		typeof CommandCollectionUpdate,
		typeof CommandCollectionDelete,
		typeof CommandDocumentAtomic,
		TObject<{
			kind: TLiteral<"command:batched">;
			commands: TArray<TThis>;
		}>,
	]>
> = Type.Recursive((self) =>
	Type.Union([
		CommandRpcInvoke,
		CommandEventSubscribe,
		CommandEventUnsubscribe,
		CommandDocumentGet,
		CommandDocumentSet,
		CommandDocumentDelete,
		CommandCollectionList,
		CommandCollectionGet,
		CommandCollectionCreate,
		CommandCollectionUpdate,
		CommandCollectionDelete,
		CommandDocumentAtomic,
		Type.Object({
			kind: Type.Literal("command:batched"),
			commands: Type.Array(self),
		}, { $id: "CommandBatched" }),
	]), { $id: "Command" });

export function isCommand(value: unknown): value is Command {
	return isCommandRpcInvoke(value) || isCommandEventSubscribe(value) ||
		isCommandEventUnsubscribe(value) || isCommandDocumentGet(value) ||
		isCommandDocumentSet(value) || isCommandDocumentDelete(value) ||
		isCommandCollectionList(value) || isCommandCollectionGet(value) ||
		isCommandCollectionCreate(value) || isCommandCollectionUpdate(value) ||
		isCommandCollectionDelete(value) || isCommandDocumentAtomic(value) ||
		isCommandBatched(value);
}

export interface CommandBatched {
	kind: "command:batched";
	commands: Command[];
}

export const CommandBatched: TObject<{
	kind: TLiteral<"command:batched">;
	commands: TArray<typeof Command>;
}> = Type.Object({
	kind: Type.Literal("command:batched"),
	commands: Type.Array(Command),
}, { $id: "BatchedCommand" });

export function isCommandBatched(value: unknown): value is CommandBatched {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command:batched" && "commands" in value && Array.isArray(value.commands) &&
		value.commands.every(isCommand);
}
