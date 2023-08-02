import { type Infer, makeAssert, makeGuard, s } from "../schema/mod.ts";
import { IDENTITY_AUTOID_PREFIX } from "./identity.ts";

export const IdentityChallengeSchema = s.describe(
	{ label: "IdentityChallenge" },
	s.object({
		identityId: s.autoid(IDENTITY_AUTOID_PREFIX),
		type: s.string(),
		confirmed: s.boolean(),
		meta: s.record(s.unknown()),
	}),
);

export type IdentityChallenge = Infer<typeof IdentityChallengeSchema>;

export const isIdentity = makeGuard(IdentityChallengeSchema);
export const assertIdentity = makeAssert(IdentityChallengeSchema);
