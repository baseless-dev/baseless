import { assertIdentityChallenge } from "../identity/challenge.ts";
import { IDENTITY_AUTOID_PREFIX } from "../identity/identity.ts";
import { autoid, isAutoId } from "../system/autoid.ts";
import { assertSchema, s } from "./mod.ts";
import z from "npm:zod";

const identityChallengeSchema = s.object({
	identityId: s.autoid(IDENTITY_AUTOID_PREFIX),
	type: s.string(),
	confirmed: s.boolean(),
	meta: s.record(s.unknown()),
});

const identityChallengeZodSchema = z.object({
	identityId: z.string().refine((v) => isAutoId(v, IDENTITY_AUTOID_PREFIX)),
	type: z.string(),
	confirmed: z.boolean(),
	meta: z.record(z.unknown()),
});

const id = autoid(IDENTITY_AUTOID_PREFIX);
const data = {
	identityId: id,
	type: "email",
	confirmed: true,
	meta: {},
};

Deno.bench("definition:schema", () => {
	// deno-lint-ignore no-unused-vars
	const identityChallengeSchema = s.object({
		identityId: s.autoid(IDENTITY_AUTOID_PREFIX),
		type: s.string(),
		confirmed: s.boolean(),
		meta: s.record(s.unknown()),
	});
});

Deno.bench("definition:zod", () => {
	// deno-lint-ignore no-unused-vars
	const identityChallengeZodSchema = z.object({
		identityId: z.string().refine((v) => isAutoId(v, IDENTITY_AUTOID_PREFIX)),
		type: z.string(),
		confirmed: z.boolean(),
		meta: z.record(z.unknown()),
	});
});

Deno.bench("assert:manual", () => {
	assertIdentityChallenge(data);
});

Deno.bench("assert:schema", () => {
	assertSchema(identityChallengeSchema, data);
});

Deno.bench("assert:zod", () => {
	identityChallengeZodSchema.parse(data);
});
