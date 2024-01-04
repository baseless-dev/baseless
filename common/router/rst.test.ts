import {
	assertObjectMatch,
	assertThrows,
} from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { parseRST } from "./rst.ts";
import * as t from "../schema/types.ts";

Deno.test("const", () => {
	assertObjectMatch(
		parseRST({
			"/foo": { GET: { handler: () => Response.error(), schemas: {} } },
		})[0],
		{
			kind: "const",
			value: "foo",
			children: [],
		},
	);
	assertObjectMatch(
		parseRST({
			"/foo/bar": { GET: { handler: () => Response.error(), schemas: {} } },
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
			"/:action": { GET: { handler: () => Response.error(), schemas: {} } },
		})[0],
		{
			kind: "param",
			name: "action",
			optional: false,
			children: [],
		},
	);
	assertObjectMatch(
		parseRST({
			"/:action?": { GET: { handler: () => Response.error(), schemas: {} } },
		})[0],
		{
			kind: "param",
			name: "action",
			optional: true,
			children: [],
		},
	);
	assertObjectMatch(
		parseRST({
			"/:action/foo": { GET: { handler: () => Response.error(), schemas: {} } },
		})[0],
		{
			kind: "param",
			name: "action",
			optional: false,
			children: [
				{ kind: "const", value: "foo", children: [] },
			],
		},
	);
	assertObjectMatch(
		parseRST({
			"/:action/:id": {
				GET: { handler: () => Response.error(), schemas: {} },
			},
		})[0],
		{
			kind: "param",
			name: "action",
			optional: false,
			children: [
				{
					kind: "param",
					name: "id",
					optional: false,
					children: [],
				},
			],
		},
	);
	assertObjectMatch(
		parseRST({
			"/:action?/:id?": {
				GET: { handler: () => Response.error(), schemas: {} },
			},
		})[0],
		{
			kind: "param",
			name: "action",
			optional: true,
			children: [
				{
					kind: "param",
					name: "id",
					optional: true,
					children: [],
				},
			],
		},
	);
	assertThrows(() =>
		parseRST({
			"/:action?/foo": {
				GET: { handler: () => Response.error(), schemas: {} },
			},
		})
	);
	assertThrows(() =>
		parseRST({
			"/:action?/:id": {
				GET: { handler: () => Response.error(), schemas: {} },
			},
		})
	);
});
