import { Validator } from "https://baseless.dev/x/json-schema/validator.ts";
import { Schema } from "https://baseless.dev/x/json-schema/types.ts";

export type { Command, Commands, Result, Results } from "https://baseless.dev/x/shared/server.ts";

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
					replace: { type: "boolean" },
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
					cmd: { const: "auth.signin-anonymously" },
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
					claimAnonymousId: { type: "string" },
				},
				required: ["locale", "email", "password"],
			},
			{
				properties: {
					cmd: { const: "auth.signin-with-email-password" },
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
			{
				properties: {
					cmd: { const: "auth.update-password" },
					newPassword: { type: "string" },
				},
				required: ["newPassword"],
			},
			{
				properties: {
					cmd: { const: "auth.refresh-tokens" },
					refresh_token: { type: "string" },
				},
				required: ["refresh_token"],
			},
		],
	},
};

export const validator = new Validator(commandsSchema);
