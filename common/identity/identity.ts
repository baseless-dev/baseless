import { type Infer, s } from "../schema/mod.ts";
import { makeAssert, makeGuard } from "../schema/types.ts";
export const IDENTITY_AUTOID_PREFIX = "id_";

export const IdentitySchema = s.describe(
	{ label: "Identity" },
	s.object({
		id: s.autoid(IDENTITY_AUTOID_PREFIX),
		meta: s.record(s.unknown()),
	}),
);

export type Identity = Infer<typeof IdentitySchema>;

export const isIdentity = makeGuard(IdentitySchema);
export const assertIdentity = makeAssert(IdentitySchema);
