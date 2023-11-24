import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import type { IContext } from "../../../server/context.ts";
import type { AuthenticationCeremonyState } from "../state.ts";
import { resolveConditional } from "./resolve_conditional.ts";

Deno.test("resolveConditional", async () => {
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
	const conditional = h.iif(() => {
		return h.sequence(email, password);
	});

	const ctx = {} as IContext;
	const state = {} as AuthenticationCeremonyState;
	assertEquals(
		await resolveConditional(conditional, ctx, state),
		h.sequence(email, password) as unknown,
	);
});
