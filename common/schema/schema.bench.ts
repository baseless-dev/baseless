import { assertIdentityComponent } from "../identity/component.ts";
import { IDENTITY_AUTOID_PREFIX } from "../identity/identity.ts";
import { autoid, isAutoId } from "../system/autoid.ts";
import { assertSchema, s } from "./mod.ts";
import z from "npm:zod";

const identityChallengeSchema = s.object({
	id: s.autoid(IDENTITY_AUTOID_PREFIX),
	identification: s.string(),
	confirmed: s.boolean(),
	meta: s.record(s.unknown()),
}, ["identification"]);

const identityChallengeZodSchema = z.object({
	id: z.string().refine((v) => isAutoId(v, IDENTITY_AUTOID_PREFIX)),
	identification: z.string().optional(),
	confirmed: z.boolean(),
	meta: z.record(z.unknown()),
});

const id = autoid(IDENTITY_AUTOID_PREFIX);
const data = {
	id: id,
	identification: "email",
	confirmed: true,
	meta: {},
};

Deno.bench(
	"define schema with baseless",
	{ group: "define", baseline: true },
	() => {
		// deno-lint-ignore no-unused-vars
		const identityChallengeSchema = s.object({
			id: s.autoid(IDENTITY_AUTOID_PREFIX),
			identification: s.string(),
			confirmed: s.boolean(),
			meta: s.record(s.unknown()),
		}, ["identification"]);
	},
);

Deno.bench(
	"define schema with zod",
	{ group: "define" },
	() => {
		// deno-lint-ignore no-unused-vars
		const identityChallengeZodSchema = z.object({
			id: z.string().refine((v) => isAutoId(v, IDENTITY_AUTOID_PREFIX)),
			identification: z.string(),
			confirmed: z.boolean(),
			meta: z.record(z.unknown()),
		});
	},
);

Deno.bench("assert with hand crafted function", {
	group: "assert",
	baseline: true,
}, () => {
	assertIdentityComponent(data);
});

Deno.bench("assert with baseless schema", { group: "assert" }, () => {
	assertSchema(identityChallengeSchema, data);
});

Deno.bench(
	"assert with zod schema",
	{ group: "assert" },
	() => {
		identityChallengeZodSchema.parse(data);
	},
);
