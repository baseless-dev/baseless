import {
	type TArray,
	type TLiteral,
	type TObject,
	type TRecursive,
	type TString,
	type TThis,
	type TUnion,
	type TUnknown,
	Type,
} from "@sinclair/typebox";

export interface CommandSingle {
	kind: "command";
	rpc: string[];
	input: unknown;
}

export const CommandSingle: TObject<{
	kind: TLiteral<"command">;
	rpc: TArray<TString>;
	input: TUnknown;
}> = Type.Object({
	kind: Type.Literal("command"),
	rpc: Type.Array(Type.String()),
	input: Type.Unknown(),
}, { $id: "CommandSingle" });

export function isCommandSingle(value: unknown): value is Command {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "command" &&
		"rpc" in value && Array.isArray(value.rpc);
}

export interface Commands {
	kind: "commands";
	commands: CommandSingle[];
}

export const Commands: TObject<{
	kind: TLiteral<"commands">;
	commands: TArray<typeof CommandSingle>;
}> = Type.Object({
	kind: Type.Literal("commands"),
	commands: Type.Array(CommandSingle),
}, { $id: "BatchedCommand" });

export function isCommands(value: unknown): value is Commands {
	return !!value && typeof value === "object" && "kind" in value &&
		value.kind === "commands" && "commands" in value && Array.isArray(value.commands) &&
		value.commands.every(isCommandSingle);
}

export type Command = CommandSingle | Commands;

export const Command: TRecursive<
	TUnion<[
		typeof CommandSingle,
		TObject<{
			kind: TLiteral<"commands">;
			commands: TArray<TThis>;
		}>,
	]>
> = Type.Recursive((self) =>
	Type.Union([
		CommandSingle,
		Type.Object({
			kind: Type.Literal("commands"),
			commands: Type.Array(self),
		}, { $id: "Commands" }),
	]), { $id: "Command" });

export function isCommand(value: unknown): value is Command {
	return isCommandSingle(value) || isCommands(value);
}
