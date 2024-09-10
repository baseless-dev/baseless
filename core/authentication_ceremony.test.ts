import { assert, assertEquals } from "@std/assert";
import {
	choice,
	extractAuthenticationCeremonyComponents,
	getAuthenticationCeremonyComponentAtPath,
	isAuthenticationCeremony,
	isAuthenticationCeremonyChoice,
	isAuthenticationCeremonyComponent,
	isAuthenticationCeremonySequence,
	sequence,
	simplifyAuthenticationCeremony,
	walkAuthenticationCeremony,
} from "./authentication_ceremony.ts";

Deno.test("AuthenticationCeremony", async (t) => {
	const a = { kind: "component", component: "a" } as const;
	const b = { kind: "component", component: "b" } as const;
	const c = { kind: "component", component: "c" } as const;
	const d = { kind: "component", component: "d" } as const;
	await t.step("isAuthenticationCeremonyComponent", () => {
		assert(isAuthenticationCeremonyComponent(a));
		assert(!isAuthenticationCeremonyComponent({ kind: "compo2nent", component: "a" }));
		assert(!isAuthenticationCeremonyComponent({ kind: "component", comp2onent: "a" }));
		assert(!isAuthenticationCeremonyComponent({}));
	});
	await t.step("isAuthenticationCeremonySequence", () => {
		assert(isAuthenticationCeremonySequence(sequence(a, b)));
		assert(
			!isAuthenticationCeremonySequence({
				kind: "sequence",
				components: a,
			}),
		);
		assert(!isAuthenticationCeremonySequence({ kind: "compo2nent", component: "a" }));
		assert(!isAuthenticationCeremonySequence({ kind: "component", comp2onent: "a" }));
		assert(!isAuthenticationCeremonySequence({}));
	});
	await t.step("isAuthenticationCeremonyChoice", () => {
		assert(isAuthenticationCeremonyChoice(choice(a, b)));
		assert(
			!isAuthenticationCeremonyChoice({
				kind: "choice",
				components: a,
			}),
		);
		assert(!isAuthenticationCeremonyChoice({ kind: "compo2nent", component: "a" }));
		assert(!isAuthenticationCeremonyChoice({ kind: "component", comp2onent: "a" }));
		assert(!isAuthenticationCeremonyChoice({}));
	});
	await t.step("isAuthenticationCeremony", () => {
		assert(isAuthenticationCeremony(choice(a, sequence(b, c))));
	});
	await t.step("extractAuthenticationCeremonyComponents", () => {
		assertEquals(
			extractAuthenticationCeremonyComponents(choice(a, sequence(b, c))),
			[a, b, c],
		);
	});
	await t.step("simplifyAuthenticationCeremony", () => {
		assertEquals(
			simplifyAuthenticationCeremony(a),
			a,
		);
		assertEquals(
			simplifyAuthenticationCeremony(sequence(sequence(a))),
			a,
		);
		assertEquals(
			simplifyAuthenticationCeremony(sequence(sequence(a), b)),
			sequence(a, b),
		);
	});
	await t.step("walkAuthenticationCeremony", () => {
		assertEquals([...walkAuthenticationCeremony(choice(a, sequence(b, c)))], [
			[a, []],
			[null, [a]],
			[b, []],
			[c, [b]],
			[null, [b, c]],
		]);
		assertEquals([...walkAuthenticationCeremony(sequence(a, choice(b, sequence(c, d))))], [
			[a, []],
			[b, [a]],
			[null, [a, b]],
			[a, []],
			[c, [a]],
			[d, [a, c]],
			[null, [a, c, d]],
		]);
	});
	await t.step("getAuthenticationCeremonyComponentAtPath", () => {
		assertEquals(
			getAuthenticationCeremonyComponentAtPath(sequence(a, choice(b, sequence(c, d))), []),
			a,
		);
		assertEquals(
			getAuthenticationCeremonyComponentAtPath(sequence(a, choice(b, sequence(c, d))), ["a"]),
			choice(b, c) as never,
		);
		assertEquals(
			getAuthenticationCeremonyComponentAtPath(sequence(a, choice(b, sequence(c, d))), [
				"a",
				"b",
			]),
			true,
		);
		assertEquals(
			getAuthenticationCeremonyComponentAtPath(sequence(a, choice(b, sequence(c, d))), [
				"a",
				"c",
			]),
			d,
		);
		assertEquals(
			getAuthenticationCeremonyComponentAtPath(sequence(a, choice(b, sequence(c, d))), [
				"a",
				"c",
				"d",
			]),
			true,
		);
		assertEquals(
			getAuthenticationCeremonyComponentAtPath(sequence(a, choice(b, sequence(c, d))), [
				"a",
				"f",
			]),
			undefined,
		);
	});
});
