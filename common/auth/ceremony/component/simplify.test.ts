import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import { simplify, simplifyWithContext } from "./simplify.ts";
import type { AuthenticationCeremonyState } from "../state.ts";
import type { Context } from "../../../server/context.ts";

Deno.test("simplify", async (t) => {
	const email = h.email();
	const password = h.password();
	const otp = h.otp({ kind: "otp" });
	const github = h.action({ kind: "github" });
	const google = h.action({ kind: "google" });
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
		const ctx = {} as Context;
		const state = {} as AuthenticationCeremonyState;
		assertEquals(
			await simplifyWithContext(conditional, ctx, state),
			h.sequence(email, password),
		);
	});
});
