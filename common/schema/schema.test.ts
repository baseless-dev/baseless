import {
	assert,
	assertEquals,
} from "https://deno.land/std@0.158.0/testing/asserts.ts";
import * as s from "./schema.ts";
import * as v from "./validator.ts";
import assertSchema from "./assertSchema.ts";
import { autoid } from "../system/autoid.ts";
import { assertThrows } from "https://deno.land/std@0.179.0/testing/asserts.ts";

Deno.test("schema", async (t) => {
	await t.step("assert string", () => {
		const testSchema = s.string([], "must be a string");
		assertSchema(testSchema, "foo");
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert array", () => {
		const testSchema = s.array(s.string(), [], "must be an array of string");
		assertSchema(testSchema, ["foo", "bar"]);
		assertThrows(() => assertSchema(testSchema, ["foo", 42]));
		assertThrows(() => assertSchema(testSchema, 42));
	});
	await t.step("assert object", () => {
		const userSchema = s.object({
			id: s.string([
				v.match(
					/^id-[ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789]{40}$/,
				),
			], "must be an ID"),
			username: s.string(
				[v.minLength(4), v.maxLength(32)],
				"must be between 4 and 32 characters",
			),
			gender: s.enumType(["male", "female", "non-binary"]),
		}, "not a valid user");

		assertSchema(userSchema, {
			id: autoid("id-"),
			username: "boby",
			gender: "male",
		});

		assertThrows(() =>
			assertSchema(userSchema, {
				id: autoid("id-"),
				username: "boby",
				gender: "not your god damn business",
			})
		);

		assertThrows(() =>
			assertSchema(userSchema, {
				id: autoid("id-"),
				username: "boby",
				gender: "male",
				age: 21,
			})
		);
	});
});
