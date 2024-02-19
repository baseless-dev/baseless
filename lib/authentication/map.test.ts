import { assertEquals } from "../../deps.test.ts";
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
