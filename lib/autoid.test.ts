import { assert } from "../deps.test.ts";
import {
	autoid,
	krsautoid,
	krsvautoid,
	ksautoid,
	ksvautoid,
	vautoid,
} from "./autoid.ts";

Deno.test("AutoID", async (t) => {
	await t.step("autoid", () => {
		assert(autoid().length === 20);
		assert(autoid() !== autoid());
	});

	await t.step("ksautoid", () => {
		assert(ksautoid().length === 28);
		assert(ksautoid() !== ksautoid());
	});

	await t.step("krsautoid", () => {
		assert(krsautoid().length === 28);
		assert(krsautoid() !== krsautoid());
	});

	await t.step("vautoid", () => {
		assert(vautoid("", 8).length === 8);
		assert(vautoid("", 8) !== vautoid("", 8));
	});

	await t.step("ksvautoid", () => {
		assert(ksvautoid("", 8).length === 16);
		assert(ksvautoid("", 8) !== ksvautoid("", 8));
	});

	await t.step("krsvautoid", () => {
		assert(krsvautoid("", 8).length === 16);
		assert(krsvautoid("", 8) !== krsvautoid("", 8));
	});
});
