import { Check, Code } from "./schema.ts";
import * as t from "./types.ts";

Deno.test("code gen", () => {
	// const shm1 = t.Object({
	// 	id: t.String(),
	// 	identification: t.String(),
	// 	confirmed: t.Boolean(),
	// 	meta: t.Record(t.String(), { minProperties: 1 }),
	// }, ["id", "confirmed", "meta"]);
	// type f = t.Infer<typeof shm1>;
	// console.log(shm1);
	// console.log(Code(shm1).toString());
	// const shm2 = t.Union(
	// 	t.Object({
	// 		id: t.String(),
	// 		identification: t.String(),
	// 		confirmed: t.Boolean(),
	// 		meta: t.Record(t.String(), { minProperties: 1 }),
	// 	}, ["id", "confirmed", "meta"]),
	// 	t.Const("foo"),
	// 	t.String({ minLength: 3 }),
	// 	t.Set(t.String()),
	// );
	// console.log(shm2);
	// console.log(Code(shm2).toString());
	const shm2 = t.Object({
		userid: t.String(),
		commentid: t.String(),
	}, ["userid"]);
	console.log(shm2);
	console.log(Code(shm2).toString());
});
