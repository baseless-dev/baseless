import { assert } from "../deps.test.ts";
import {
	autoid,
	AutoIdGenerator,
	AutoIdStream,
	krsautoid,
	ksautoid,
} from "./autoid.ts";

Deno.test("AutoID", async (t) => {
	await t.step("autoid", () => {
		assert(autoid().length === 22);
		assert(autoid() !== autoid());
	});

	await t.step("ksautoid", () => {
		assert(ksautoid().length === 30);
		assert(ksautoid() !== ksautoid());
	});

	await t.step("krsautoid", () => {
		assert(krsautoid().length === 30);
		assert(krsautoid() !== krsautoid());
	});

	await t.step("AutoIdGenerator", async () => {
		const gen = new AutoIdGenerator();
		const id1 = gen.read();
		await gen.write([0, 1, 2]);
		const id2 = gen.read();
		await gen.write([0, 1, 2]);
		const id3 = gen.read();
		assert(id1.length === 22);
		assert(id2.length === 22);
		assert(id3.length === 22);
		assert(id2 !== id1);
		assert(id3 !== id1);
		assert(id3 !== id2);
	});

	await t.step("AutoIdStream", async () => {
		const stream = new AutoIdStream();
		const writer = stream.getWriter();
		const id1 = stream.read();
		await writer.write([0, 1, 2]);
		const id2 = stream.read();
		await writer.write([0, 1, 2]);
		const id3 = stream.read();
		assert(id1.length === 22);
		assert(id2.length === 22);
		assert(id3.length === 22);
		assert(id2 !== id1);
		assert(id3 !== id1);
		assert(id3 !== id2);
	});
});
