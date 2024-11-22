import {
	type TArray,
	type TBoolean,
	type TLiteral,
	type TNull,
	type TNumber,
	type TObject,
	type TOptional,
	type TString,
	type TUnion,
	type TUnknown,
	Type,
} from "@sinclair/typebox";

export interface CommandRpc {
	kind: "rpc";
	rpc: string[];
	input: unknown;
}

export const CommandRpc: TObject<{
	kind: TLiteral<"rpc">;
	rpc: TArray<TString>;
	input: TUnknown;
}> = Type.Object({
	kind: Type.Literal("rpc"),
	rpc: Type.Array(Type.String()),
	input: Type.Unknown(),
}, { $id: "CommandRpc" });

export function isCommandRpc(value?: unknown): value is CommandRpc {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "rpc" &&
		"rpc" in value && Array.isArray(value.rpc);
}

export interface CommandDocumentGet {
	kind: "document-get";
	path: string[];
}

export const CommandDocumentGet: TObject<{
	kind: TLiteral<"document-get">;
	path: TArray<TString>;
}> = Type.Object({
	kind: Type.Literal("document-get"),
	path: Type.Array(Type.String()),
}, { $id: "CommandDocumentGet" });

export function isCommandDocumentGet(value?: unknown): value is CommandDocumentGet {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "document-get" &&
		"path" in value && Array.isArray(value.path) &&
		value.path.every((v) => typeof v === "string");
}

export interface CommandDocumentGetMany {
	kind: "document-get-many";
	paths: string[][];
}

export const CommandDocumentGetMany: TObject<{
	kind: TLiteral<"document-get-many">;
	paths: TArray<TArray<TString>>;
}> = Type.Object({
	kind: Type.Literal("document-get-many"),
	paths: Type.Array(Type.Array(Type.String())),
}, { $id: "CommandDocumentGetMany" });

export function isCommandDocumentGetMany(value?: unknown): value is CommandDocumentGetMany {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "document-get-many" &&
		"paths" in value && Array.isArray(value.paths) &&
		value.paths.every((v) => Array.isArray(v) && v.every((v) => typeof v === "string"));
}

export interface CommandDocumentList {
	kind: "document-list";
	prefix: string[];
	cursor?: string;
	limit?: number;
}

export const CommandDocumentList: TObject<{
	kind: TLiteral<"document-list">;
	prefix: TArray<TString>;
	cursor: TOptional<TString>;
	limit: TOptional<TNumber>;
}> = Type.Object({
	kind: Type.Literal("document-list"),
	prefix: Type.Array(Type.String()),
	cursor: Type.Optional(Type.String()),
	limit: Type.Optional(Type.Number()),
}, { $id: "CommandDocumentList" });

export function isCommandDocumentList(value?: unknown): value is CommandDocumentList {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "document-list" &&
		"prefix" in value && Array.isArray(value.prefix) &&
		value.prefix.every((v) => typeof v === "string") &&
		("cursor" in value ? typeof value.cursor === "string" : true) &&
		("limit" in value ? typeof value.limit === "number" : true);
}

export type CommandDocumentAtomicCheck = {
	type: "check";
	key: string[];
	versionstamp: string | null;
};

export const CommandDocumentAtomicCheck: TObject<{
	type: TLiteral<"check">;
	key: TArray<TString>;
	versionstamp: TUnion<[TString, TNull]>;
}> = Type.Object({
	type: Type.Literal("check"),
	key: Type.Array(Type.String()),
	versionstamp: Type.Union([Type.String(), Type.Null()]),
}, { $id: "CommandDocumentAtomicCheck" });

export function isCommandDocumentAtomicCheck(value?: unknown): value is CommandDocumentAtomicCheck {
	return !!value && typeof value === "object" && "type" in value &&
		value.type === "check" &&
		"key" in value && Array.isArray(value.key) &&
		value.key.every((v) => typeof v === "string") &&
		"versionstamp" in value && (typeof value.versionstamp === "string" || value.versionstamp === null);
}

export type CommandDocumentAtomicOp =
	| { type: "set"; key: string[]; data: unknown }
	| { type: "delete"; key: string[] };

export const CommandDocumentAtomicOp: TUnion<[
	TObject<{ type: TLiteral<"set">; key: TArray<TString>; data: TUnknown }>,
	TObject<{ type: TLiteral<"delete">; key: TArray<TString> }>,
]> = Type.Union([
	Type.Object({
		type: Type.Literal("set"),
		key: Type.Array(Type.String()),
		data: Type.Unknown(),
	}),
	Type.Object({
		type: Type.Literal("delete"),
		key: Type.Array(Type.String()),
	}),
], { $id: "CommandDocumentAtomicOp" });

export function isCommandDocumentAtomicOp(value?: unknown): value is CommandDocumentAtomicOp {
	return !!value && typeof value === "object" && "type" in value &&
		(value.type === "set"
			? "key" in value && Array.isArray(value.key) &&
				value.key.every((v) => typeof v === "string") &&
				"data" in value
			: value.type === "delete" &&
				"key" in value && Array.isArray(value.key) &&
				value.key.every((v) => typeof v === "string"));
}

export interface CommandDocumentAtomic {
	kind: "document-atomic";
	checks: CommandDocumentAtomicCheck[];
	ops: CommandDocumentAtomicOp[];
}

export const CommandDocumentAtomic: TObject<{
	kind: TLiteral<"document-atomic">;
	checks: TArray<typeof CommandDocumentAtomicCheck>;
	ops: TArray<typeof CommandDocumentAtomicOp>;
}> = Type.Object({
	kind: Type.Literal("document-atomic"),
	checks: Type.Array(CommandDocumentAtomicCheck),
	ops: Type.Array(CommandDocumentAtomicOp),
}, { $id: "CommandDocumentAtomic" });

export function isCommandDocumentAtomic(value?: unknown): value is CommandDocumentAtomic {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "document-atomic" &&
		"checks" in value && Array.isArray(value.checks) &&
		value.checks.every(isCommandDocumentAtomicCheck) &&
		"ops" in value && Array.isArray(value.ops) &&
		value.ops.every(isCommandDocumentAtomicOp);
}

export interface CommandDocumentWatch {
	kind: "document-watch";
	key: string[];
}

export const CommandDocumentWatch: TObject<{
	kind: TLiteral<"document-watch">;
	key: TArray<TString>;
}> = Type.Object({
	kind: Type.Literal("document-watch"),
	key: Type.Array(Type.String()),
}, { $id: "CommandDocumentWatch" });

export function isCommandDocumentWatch(value?: unknown): value is CommandDocumentWatch {
	return !!value && typeof value === "object" && "kind" in value && value.kind === "document-watch" && "key" in value &&
		Array.isArray(value.key) && value.key.every((v) => typeof v === "string");
}

export interface CommandDocumentUnwatch {
	kind: "document-unwatch";
	key: string[];
}

export const CommandDocumentUnwatch: TObject<{
	kind: TLiteral<"document-unwatch">;
	key: TArray<TString>;
}> = Type.Object({
	kind: Type.Literal("document-unwatch"),
	key: Type.Array(Type.String()),
}, { $id: "CommandDocumentUnwatch" });

export function isCommandDocumentUnwatch(value?: unknown): value is CommandDocumentUnwatch {
	return !!value && typeof value === "object" && "kind" in value && value.kind === "document-unwatch" && "key" in value &&
		Array.isArray(value.key) && value.key.every((v) => typeof v === "string");
}

export interface CommandCollectionWatch {
	kind: "collection-watch";
	key: string[];
	before?: string;
	beforeInclusive?: boolean;
	after?: string;
	afterInclusive?: boolean;
}

export const CommandCollectionWatch: TObject<{
	kind: TLiteral<"collection-watch">;
	key: TArray<TString>;
	before: TOptional<TString>;
	beforeInclusive: TOptional<TBoolean>;
	after: TOptional<TString>;
	afterInclusive: TOptional<TBoolean>;
}> = Type.Object({
	kind: Type.Literal("collection-watch"),
	key: Type.Array(Type.String()),
	before: Type.Optional(Type.String()),
	beforeInclusive: Type.Optional(Type.Boolean()),
	after: Type.Optional(Type.String()),
	afterInclusive: Type.Optional(Type.Boolean()),
}, { $id: "CommandCollectionWatch" });

export function isCommandCollectionWatch(value?: unknown): value is CommandCollectionWatch {
	return !!value && typeof value === "object" && "kind" in value && value.kind === "collection-watch" && "key" in value &&
		Array.isArray(value.key) && value.key.every((v) => typeof v === "string") &&
		("before" in value ? typeof value.before === "string" : true) &&
		("beforeInclusive" in value ? typeof value.beforeInclusive === "boolean" : true) &&
		("after" in value ? typeof value.after === "string" : true) &&
		("afterInclusive" in value ? typeof value.afterInclusive === "boolean" : true);
}

export interface CommandCollectionUnwatch {
	kind: "collection-unwatch";
	key: string[];
	before?: string;
	beforeInclusive?: boolean;
	after?: string;
	afterInclusive?: boolean;
}

export const CommandCollectionUnwatch: TObject<{
	kind: TLiteral<"collection-unwatch">;
	key: TArray<TString>;
	before: TOptional<TString>;
	beforeInclusive: TOptional<TBoolean>;
	after: TOptional<TString>;
	afterInclusive: TOptional<TBoolean>;
}> = Type.Object({
	kind: Type.Literal("collection-unwatch"),
	key: Type.Array(Type.String()),
	before: Type.Optional(Type.String()),
	beforeInclusive: Type.Optional(Type.Boolean()),
	after: Type.Optional(Type.String()),
	afterInclusive: Type.Optional(Type.Boolean()),
}, { $id: "CommandCollectionUnwatch" });

export function isCommandCollectionUnwatch(value?: unknown): value is CommandCollectionUnwatch {
	return !!value && typeof value === "object" && "kind" in value && value.kind === "collection-unwatch" && "key" in value &&
		Array.isArray(value.key) && value.key.every((v) => typeof v === "string") &&
		("before" in value ? typeof value.before === "string" : true) &&
		("beforeInclusive" in value ? typeof value.beforeInclusive === "boolean" : true) &&
		("after" in value ? typeof value.after === "string" : true) &&
		("afterInclusive" in value ? typeof value.afterInclusive === "boolean" : true);
}

export interface CommandEventPublish {
	kind: "event-publish";
	event: string[];
	payload: unknown;
}

export const CommandEventPublish: TObject<{
	kind: TLiteral<"event-publish">;
	event: TArray<TString>;
	payload: TUnknown;
}> = Type.Object({
	kind: Type.Literal("event-publish"),
	event: Type.Array(Type.String()),
	payload: Type.Unknown(),
}, { $id: "CommandEventPublish" });

export function isCommandEventPublish(value?: unknown): value is CommandEventPublish {
	return !!value && typeof value === "object" && "kind" in value && value.kind === "event-publish" && "event" in value &&
		Array.isArray(value.event) && value.event.every((v) => typeof v === "string") && "payload" in value;
}

export interface CommandEventSubscribe {
	kind: "event-subscribe";
	event: string[];
}

export const CommandEventSubscribe: TObject<{
	kind: TLiteral<"event-subscribe">;
	event: TArray<TString>;
}> = Type.Object({
	kind: Type.Literal("event-subscribe"),
	event: Type.Array(Type.String()),
}, { $id: "CommandEventSubscribe" });

export function isCommandEventSubscribe(value?: unknown): value is CommandEventSubscribe {
	return !!value && typeof value === "object" && "kind" in value && value.kind === "event-subscribe" && "event" in value &&
		Array.isArray(value.event) && value.event.every((v) => typeof v === "string");
}

export interface CommandEventUnsubscribe {
	kind: "event-unsubscribe";
	event: string[];
}

export const CommandEventUnsubscribe: TObject<{
	kind: TLiteral<"event-unsubscribe">;
	event: TArray<TString>;
}> = Type.Object({
	kind: Type.Literal("event-unsubscribe"),
	event: Type.Array(Type.String()),
}, { $id: "CommandEventUnsubscribe" });

export function isCommandEventUnsubscribe(value?: unknown): value is CommandEventUnsubscribe {
	return !!value && typeof value === "object" && "kind" in value && value.kind === "event-unsubscribe" && "event" in value &&
		Array.isArray(value.event) && value.event.every((v) => typeof v === "string");
}

export type Command =
	| CommandRpc
	| CommandDocumentGet
	| CommandDocumentGetMany
	| CommandDocumentList
	| CommandDocumentAtomic
	| CommandDocumentWatch
	| CommandDocumentUnwatch
	| CommandCollectionWatch
	| CommandCollectionUnwatch
	| CommandEventPublish
	| CommandEventSubscribe
	| CommandEventUnsubscribe;

export const Command: TUnion<[
	typeof CommandRpc,
	typeof CommandDocumentGet,
	typeof CommandDocumentGetMany,
	typeof CommandDocumentList,
	typeof CommandDocumentAtomic,
	typeof CommandDocumentWatch,
	typeof CommandDocumentUnwatch,
	typeof CommandCollectionWatch,
	typeof CommandCollectionUnwatch,
	typeof CommandEventPublish,
	typeof CommandEventSubscribe,
	typeof CommandEventUnsubscribe,
]> = Type.Union([
	CommandRpc,
	CommandDocumentGet,
	CommandDocumentGetMany,
	CommandDocumentList,
	CommandDocumentAtomic,
	CommandDocumentWatch,
	CommandDocumentUnwatch,
	CommandCollectionWatch,
	CommandCollectionUnwatch,
	CommandEventPublish,
	CommandEventSubscribe,
	CommandEventUnsubscribe,
], { $id: "Command" });

export function isCommand(value?: unknown): value is Command {
	return isCommandRpc(value) || isCommandDocumentGet(value) || isCommandDocumentGetMany(value) ||
		isCommandDocumentList(value) || isCommandDocumentAtomic(value) || isCommandDocumentWatch(value) ||
		isCommandCollectionWatch(value) || isCommandEventPublish(value) || isCommandEventSubscribe(value) ||
		isCommandEventUnsubscribe(value);
}

export interface Commands {
	kind: "commands";
	commands: Command[];
}

export const Commands: TObject<{
	kind: TLiteral<"commands">;
	commands: TArray<typeof Command>;
}> = Type.Object({
	kind: Type.Literal("commands"),
	commands: Type.Array(Command),
}, { $id: "Commands" });

export function isCommands(value?: unknown): value is Commands {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "commands" &&
		"commands" in value && Array.isArray(value.commands) &&
		value.commands.every(isCommand);
}
