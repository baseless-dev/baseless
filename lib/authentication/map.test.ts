import { assertEquals } from "https://deno.land/std@0.213.0/assert/mod.ts";
import { map } from "./map.ts";
import {
	type AuthenticationCeremonyComponent,
	oneOf,
	sequence,
} from "./types.ts";

Deno.test("map", () => {
	const email: AuthenticationCeremonyComponent = {
		kind: "prompt",
		id: "email",
		prompt: "email",
		options: {},
	};
	const password: AuthenticationCeremonyComponent = {
		kind: "prompt",
		id: "password",
		prompt: "password",
		options: {},
	};

	assertEquals(
		map(
			sequence(email, password),
			(component) => component === email ? password : component,
		),
		sequence(password, password),
	);
	assertEquals(
		map(
			oneOf(email, password),
			(component) => component === email ? password : component,
		),
		oneOf(password, password),
	);
});
