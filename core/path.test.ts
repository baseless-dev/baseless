import { assertEquals } from "@std/assert";
import { comparePaths, convertPathToParams, convertPathToTemplate, matchPath } from "./path.ts";

Deno.test("path", async (ctx) => {
	await ctx.step("convertPathToParams", () => {
		assertEquals(convertPathToParams("foo"), "{}");
		assertEquals(convertPathToParams("foo/bar"), "{}");
		assertEquals(convertPathToParams("foo/:bar"), "{ bar: string }");
		assertEquals(convertPathToParams("foo/:bar/moo"), "{ bar: string }");
		assertEquals(convertPathToParams("foo/:bar/moo/:joo"), "{ bar: string; joo: string }");
		assertEquals(convertPathToParams(":a/:b/:c/:d"), "{ a: string; b: string; c: string; d: string }");
	});
	await ctx.step("convertPathToTemplate", () => {
		assertEquals(convertPathToTemplate("foo"), "foo");
		assertEquals(convertPathToTemplate("foo/bar"), "foo/bar");
		assertEquals(convertPathToTemplate("foo/:bar"), "foo/${string}");
		assertEquals(convertPathToTemplate("foo/:bar/moo"), "foo/${string}/moo");
		assertEquals(convertPathToTemplate("foo/:bar/moo/:joo"), "foo/${string}/moo/${string}");
		assertEquals(convertPathToTemplate(":a/:b/:c/:d"), "${string}/${string}/${string}/${string}");
	});
	await ctx.step("comparePaths", () => {
		assertEquals(comparePaths({ path: "a" }, { path: "a" }), 0);
		assertEquals(comparePaths({ path: "a" }, { path: "b" }), -1);
		assertEquals(comparePaths({ path: "b" }, { path: "a" }), 1);
		assertEquals(comparePaths({ path: ":a" }, { path: ":b" }), 0);
		assertEquals(comparePaths({ path: "a/:b" }, { path: "a/:b" }), 0);
		assertEquals(comparePaths({ path: "a/:b" }, { path: "b/:c" }), -1);
		assertEquals(comparePaths({ path: "b/:c" }, { path: "a/:b" }), 1);
	});
	await ctx.step("matchPath", () => {
		const matcher = matchPath([
			{ path: ":a/:b/:c/:d" },
			{ path: "foo" },
			{ path: "foo/:bar" },
			{ path: "bar" },
		]);
		assertEquals(matcher("foo").next().value, [{}, { path: "foo" }]);
		assertEquals(matcher("bar").next().value, [{}, { path: "bar" }]);
		assertEquals(matcher("foo/1").next().value, [{ bar: "1" }, { path: "foo/:bar" }]);
		assertEquals(matcher("1/2/3/4").next().value, [{ a: "1", b: "2", c: "3", d: "4" }, { path: ":a/:b/:c/:d" }]);
		assertEquals(matcher("unknown").next().done, true);
	});
});
