import {
	assertIdentityChallenge,
	isIdentityChallenge,
} from "../identity/challenge.ts";
import { IDENTITY_AUTOID_PREFIX } from "../identity/identity.ts";
import { autoid } from "../system/autoid.ts";
import { assertSchema, isSchema, s } from "./mod.ts";

const identityChallengeSchema = s.object({
	identityId: s.autoid(IDENTITY_AUTOID_PREFIX),
	type: s.string(),
	confirmed: s.boolean(),
	meta: s.record(s.unknown()),
});

const id = autoid(IDENTITY_AUTOID_PREFIX);
const data = {
	identityId: id,
	type: "email",
	confirmed: true,
	meta: {},
};

Deno.bench("assertIdentityChallenge", () => {
	assertIdentityChallenge(data);
});

Deno.bench("assertSchema", () => {
	assertSchema(identityChallengeSchema, data);
});

Deno.bench("isIdentityChallenge", () => {
	isIdentityChallenge(data);
});

Deno.bench("isSchema", () => {
	isSchema(identityChallengeSchema, data);
});
