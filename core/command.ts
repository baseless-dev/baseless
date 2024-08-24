import {
	type TArray,
	type TLiteral,
	TNumber,
	type TObject,
	TOptional,
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
	versionstamp: TOptional<TString>;
}> = Type.Object({
	type: Type.Literal("check"),
	key: Type.Array(Type.String()),
	versionstamp: Type.Optional(Type.String()),
}, { $id: "CommandDocumentAtomicCheck" });

export function isCommandDocumentAtomicCheck(value?: unknown): value is CommandDocumentAtomicCheck {
	return !!value && typeof value === "object" && "type" in value &&
		value.type === "check" &&
		"key" in value && Array.isArray(value.key) &&
		value.key.every((v) => typeof v === "string") &&
		("versionstamp" in value ? typeof value.versionstamp === "string" : true);
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

export type Command =
	| CommandRpc
	| CommandDocumentGet
	| CommandDocumentGetMany
	| CommandDocumentList
	| CommandDocumentAtomic;

export const Command: TUnion<[
	typeof CommandRpc,
	typeof CommandDocumentGet,
	typeof CommandDocumentGetMany,
	typeof CommandDocumentList,
	typeof CommandDocumentAtomic,
]> = Type.Union([
	CommandRpc,
	CommandDocumentGet,
	CommandDocumentGetMany,
	CommandDocumentList,
	CommandDocumentAtomic,
], { $id: "Command" });

export function isCommand(value?: unknown): value is Command {
	return isCommandRpc(value) || isCommandDocumentGet(value) || isCommandDocumentGetMany(value) ||
		isCommandDocumentList(value) || isCommandDocumentAtomic(value);
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
