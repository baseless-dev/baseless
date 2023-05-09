import {
	assert,
	assertEquals,
	assertThrows,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { err, ok } from "./result.ts";

Deno.test("Result", async (t) => {
	await t.step("ok", () => {
		assert(ok().isOk === true);
		assert(ok(1).isOk === true);
		assert(ok().isError === false);
	});
	await t.step("err", () => {
		assert(err(1).isOk === false);
		assert(err(1).isError === true);
	});
	await t.step("unwrap", () => {
		assertEquals(ok(1).unwrap(), 1);
		assertThrows(() => err(1).unwrap());
	});
	await t.step("and", () => {
		assertEquals(ok(1).and(ok(2)), ok(2));
		assertEquals(ok(1).and(err(2)), err(2));
		assertEquals(err(1).and(err(2)), err(1));
		assertEquals(err(1).and(ok(2)), err(1));
	});
	await t.step("andThen", () => {
		assertEquals(ok(1).andThen(() => ok(2)), ok(2));
		assertEquals(ok(1).andThen(() => err(2)), err(2));
		assertEquals(err(1).andThen(() => err(2)), err(1));
		assertEquals(err(1).andThen(() => ok(2)), err(1));
	});
	await t.step("or", () => {
		assertEquals(ok(1).or(ok(2)), ok(1));
		assertEquals(ok(1).or(err(2)), ok(1));
		assertEquals(err(1).or(err(2)), err(2));
		assertEquals(err(1).or(ok(2)), ok(2));
	});
	await t.step("orThen", () => {
		assertEquals(ok(1).orThen(() => ok(2)), ok(1));
		assertEquals(ok(1).orThen(() => err(2)), ok(1));
		assertEquals(err(1).orThen(() => err(2)), err(2));
		assertEquals(err(1).orThen(() => ok(2)), ok(2));
	});
	await t.step("map", () => {
		assertEquals(ok(1).map((_) => ok(2)), ok(2));
		assertEquals(err(1).map(), err(1));
	});
	await t.step("mapErr", () => {
		assertEquals(ok(1).mapErr(), ok(1));
		assertEquals(err(1).mapErr((_) => err(2)), err(2));
	});
});
