import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { simplify, simplifyWithContext } from "./simplify.ts";
import { IContext } from "../../../server/context.ts";
import { type AuthenticationCeremonyStateSchema } from "../state.ts";
import { Infer } from "../../../schema/types.ts";

Deno.test("simplify", async (t) => {
	const email = {
		kind: "identification" as const,
		id: "email",
		prompt: "email" as const,
	};
	const password = {
		kind: "challenge" as const,
		id: "password",
		prompt: "password" as const,
	};
	const otp = { kind: "challenge" as const, id: "otp", prompt: "otp" as const };
	const github = {
		kind: "identification" as const,
		id: "github",
		prompt: "action" as const,
	};
	const google = {
		kind: "identification" as const,
		id: "google",
		prompt: "action" as const,
	};
	const conditional = h.iif((_ctx, _state) => {
		return h.sequence(email, password);
	});

	await t.step("without context", () => {
		assertEquals(simplify(email), email);
		assertEquals(simplify(password), password);
		assertEquals(
			simplify(h.sequence(email, password)),
			h.sequence(email, password),
		);
		assertEquals(
			simplify(h.sequence(email, h.sequence(password, otp))),
			h.sequence(email, password, otp),
		);
		assertEquals(
			simplify(h.oneOf(email, github)),
			h.oneOf(email, github),
		);
		assertEquals(
			simplify(h.oneOf(email, h.oneOf(google, github))),
			h.oneOf(email, google, github),
		);
		assertEquals(
			simplify(
				h.oneOf(
					h.sequence(email, password),
					h.sequence(email, otp),
					h.oneOf(google, github),
				),
			),
			h.oneOf(
				h.sequence(email, password),
				h.sequence(email, otp),
				google,
				github,
			),
		);
	});

	await t.step("with context", async () => {
		const ctx = {} as IContext;
		const state = {} as Infer<typeof AuthenticationCeremonyStateSchema>;
		assertEquals(
			await simplifyWithContext(conditional, ctx, state),
			h.sequence(email, password),
		);
	});
});
