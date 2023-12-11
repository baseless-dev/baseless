import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import * as h from "./helpers.ts";
import type { IContext } from "../../../server/context.ts";
import type { AuthenticationCeremonyState } from "../state.ts";
import { resolveConditional } from "./resolve_conditional.ts";
import type { AuthenticationCeremonyComponentPrompt } from "../ceremony.ts";

Deno.test("resolveConditional", async () => {
	const email: AuthenticationCeremonyComponentPrompt = {
		kind: "prompt",
		id: "email",
		prompt: "email",
		options: {},
	};
	const password: AuthenticationCeremonyComponentPrompt = {
		kind: "prompt",
		id: "password",
		prompt: "password",
		options: {},
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
