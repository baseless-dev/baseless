import { type Infer, makeAssert, makeGuard, s } from "../schema/mod.ts";
import { IDENTITY_AUTOID_PREFIX } from "./identity.ts";

export const IdentityIdentificationSchema = s.describe(
	{ label: "IdentityIdentification" },
	s.object({
		identityId: s.autoid(IDENTITY_AUTOID_PREFIX),
		type: s.string(),
		identification: s.string(),
		confirmed: s.boolean(),
		meta: s.record(s.unknown()),
	}),
);

export type IdentityIdentification = Infer<typeof IdentityIdentificationSchema>;

export const isIdentity = makeGuard(IdentityIdentificationSchema);
export const assertIdentity = makeAssert(IdentityIdentificationSchema);
