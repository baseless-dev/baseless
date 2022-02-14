import { KVScanFilter } from "https://baseless.dev/x/provider/kv.ts";
import { Validator } from "https://baseless.dev/x/json-schema/validator.ts";
import { Schema } from "https://baseless.dev/x/json-schema/types.ts";

export type Commands = { [id: string]: Command };

export type Command =
	| { cmd: "fn.call"; ref: string }
	| { cmd: "db.get"; ref: string }
	| { cmd: "db.create"; ref: string; metadata: Record<string, unknown>; data?: Record<string, unknown> }
	| { cmd: "db.update"; ref: string; metadata: Record<string, unknown>; data?: Record<string, unknown> }
	| { cmd: "db.list"; ref: string; filter?: KVScanFilter<Record<string, unknown>> }
	| { cmd: "db.delete"; ref: string }
	| { cmd: "kv.get"; key: string }
	| { cmd: "kv.set"; key: string; metadata: Record<string, unknown>; data?: Record<string, unknown> }
	| { cmd: "kv.list"; prefix: string; filter?: KVScanFilter<Record<string, unknown>> }
	| { cmd: "kv.delete"; key: string }
	| { cmd: "auth.create-anonymous-user" }
	| {
		cmd: "auth.add-sign-with-email-password";
		locale: string;
		email: string;
		password: string;
	}
	| {
		cmd: "auth.create-user-with-email-password";
		locale: string;
		email: string;
		password: string;
	}
	| { cmd: "auth.sign-with-email-password"; email: string; password: string }
	| { cmd: "auth.send-email-validation-code"; locale: string; email: string }
	| { cmd: "auth.validate-email"; email: string; code: string }
	| { cmd: "auth.send-password-reset-code"; locale: string; email: string }
	| {
		cmd: "auth.reset-password";
		email: string;
		code: string;
		password: string;
	};

export type Results = { [id: string]: Result };

export type Result =
	| { error?: string; args?: string[] }
	| { ret: string }
	| { metadata: Record<string, unknown>; data?: Record<string, unknown> }
	| { docs: { ref: string; metadata: Record<string, unknown>; data?: Record<string, unknown> }[] }
	| { access_token: string; refresh_token?: string };

const commandsSchema: Schema = {
	"$defs": {
		"filter": {
			type: "object",
			additionalProperties: {
				type: "object",
				oneOf: [
					{
						properties: { eq: { type: ["string", "number", "boolean"] } },
						required: ["eq"],
					},
					{
						properties: { neq: { type: ["string", "number", "boolean"] } },
						required: ["neq"],
					},
					{
						properties: { gt: { type: ["string", "number", "boolean"] } },
						required: ["gt"],
					},
					{
						properties: { gte: { type: ["string", "number", "boolean"] } },
						required: ["gte"],
					},
					{
						properties: { lt: { type: ["string", "number", "boolean"] } },
						required: ["lt"],
					},
					{
						properties: { lte: { type: ["string", "number", "boolean"] } },
						required: ["lte"],
					},
					{
						properties: {
							in: {
								type: "array",
								items: { type: ["string", "number", "boolean"] },
							},
						},
						required: ["in"],
					},
					{
						properties: {
							nin: {
								type: "array",
								items: { type: ["string", "number", "boolean"] },
							},
						},
						required: ["nin"],
					},
				],
			},
		},
	},
	type: "object",
	additionalProperties: {
		type: "object",
		required: ["cmd"],
		oneOf: [
			{
				properties: {
					cmd: { const: "fn.call" },
					ref: { type: "string" },
				},
				required: ["ref"],
			},
			{
				properties: {
					cmd: { const: "db.get" },
					ref: { type: "string" },
				},
				required: ["ref"],
			},
			{
				properties: {
					cmd: { const: "db.create" },
					ref: { type: "string" },
					metadata: { type: "object" },
					data: { type: "object" },
				},
				required: ["ref", "metadata"],
			},
			{
				properties: {
					cmd: { const: "db.update" },
					ref: { type: "string" },
					metadata: { type: "object" },
					data: { type: "object" },
				},
				required: ["ref", "metadata"],
			},
			{
				properties: {
					cmd: { const: "db.list" },
					ref: { type: "string" },
					filter: { "$ref": "#/$defs/filter" },
				},
				required: ["ref"],
			},
			{
				properties: {
					cmd: { const: "db.delete" },
					ref: { type: "string" },
				},
				required: ["ref"],
			},
			{
				properties: {
					cmd: { const: "kv.get" },
					key: { type: "string" },
				},
				required: ["key"],
			},
			{
				properties: {
					cmd: { const: "kv.set" },
					key: { type: "string" },
					metadata: { type: "object" },
					data: { type: ["string", "object"] },
				},
				required: ["key", "metadata"],
			},
			{
				properties: {
					cmd: { const: "kv.list" },
					prefix: { type: "string" },
					filter: { "$ref": "#/$defs/filter" },
				},
				required: ["prefix"],
			},
			{
				properties: {
					cmd: { const: "kv.delete" },
					key: { type: "string" },
				},
				required: ["key"],
			},
			{
				properties: {
					cmd: { const: "auth.create-anonymous-user" },
				},
			},
			{
				properties: {
					cmd: { const: "auth.add-sign-with-email-password" },
					locale: { type: "string" },
					email: { type: "string" },
					password: { type: "string" },
				},
				required: ["locale", "email", "password"],
			},
			{
				properties: {
					cmd: { const: "auth.create-user-with-email-password" },
					locale: { type: "string" },
					email: { type: "string" },
					password: { type: "string" },
				},
				required: ["locale", "email", "password"],
			},
			{
				properties: {
					cmd: { const: "auth.sign-with-email-password" },
					email: { type: "string" },
					password: { type: "string" },
				},
				required: ["email", "password"],
			},
			{
				properties: {
					cmd: { const: "auth.send-email-validation-code" },
					locale: { type: "string" },
					email: { type: "string" },
				},
				required: ["locale", "email"],
			},
			{
				properties: {
					cmd: { const: "auth.validate-email" },
					email: { type: "string" },
					code: { type: "string" },
				},
				required: ["email", "code"],
			},
			{
				properties: {
					cmd: { const: "auth.send-password-reset-code" },
					email: { type: "string" },
					locale: { type: "string" },
				},
				required: ["email", "locale"],
			},
			{
				properties: {
					cmd: { const: "auth.reset-password" },
					email: { type: "string" },
					code: { type: "string" },
					password: { type: "string" },
				},
				required: ["email", "code", "password"],
			},
		],
	},
};

export const validator = new Validator(commandsSchema);
