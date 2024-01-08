import {
	assertObjectMatch,
	assertThrows,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { parseRST } from "./rst.ts";

Deno.test("const", () => {
	assertObjectMatch(
		parseRST({
			"/foo": { GET: { handler: () => Response.error(), definition: {} } },
		})[0],
		{
			kind: "const",
			value: "foo",
			children: [],
		},
	);
	assertObjectMatch(
		parseRST({
			"/foo/bar": { GET: { handler: () => Response.error(), definition: {} } },
		})[0],
		{
			kind: "const",
			value: "foo",
			children: [
				{ kind: "const", value: "bar", children: [] },
			],
		},
	);
});

Deno.test("param", () => {
	assertObjectMatch(
		parseRST({
			"/:action": { GET: { handler: () => Response.error(), definition: {} } },
		})[0],
		{
			kind: "param",
			name: "action",
			children: [],
		},
	);
	assertObjectMatch(
		parseRST({
			"/:action/foo": {
				GET: { handler: () => Response.error(), definition: {} },
			},
		})[0],
		{
			kind: "param",
			name: "action",
			children: [
				{ kind: "const", value: "foo", children: [] },
			],
		},
	);
	assertObjectMatch(
		parseRST({
			"/:action/:id": {
				GET: { handler: () => Response.error(), definition: {} },
			},
		})[0],
		{
			kind: "param",
			name: "action",
			children: [
				{
					kind: "param",
					name: "id",
					children: [],
				},
			],
		},
	);
});
