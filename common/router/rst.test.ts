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
			"/{action}": { GET: { handler: () => Response.error(), definition: {} } },
		})[0],
		{
			kind: "param",
			name: "action",
			children: [],
		},
	);
	assertObjectMatch(
		parseRST({
			"/{action}/foo": {
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
			"/{action}/{id}": {
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

Deno.test("rest", () => {
	assertObjectMatch(
		parseRST({
			"/{...paths}": {
				GET: { handler: () => Response.error(), definition: {} },
			},
		})[0],
		{
			kind: "rest",
			name: "paths",
		},
	);
	assertObjectMatch(
		parseRST({
			"/{action}/{...paths}": {
				GET: { handler: () => Response.error(), definition: {} },
			},
		})[0],
		{
			kind: "param",
			name: "action",
			children: [
				{ kind: "rest", name: "paths" },
			],
		},
	);
	assertThrows(
		() =>
			parseRST({
				"/{...paths}/not/the/end": {
					GET: { handler: () => Response.error(), definition: {} },
				},
			}),
	);
	assertThrows(
		() =>
			parseRST({
				"/{...paths}/{id}": {
					GET: { handler: () => Response.error(), definition: {} },
				},
			}),
	);
});

Deno.test("complexe", () => {
	const rst = parseRST({
		"/login": {
			GET: { handler: () => Response.error(), definition: {} },
		},
		"/users/{id}": {
			GET: { handler: () => Response.error(), definition: {} },
			POST: { handler: () => Response.error(), definition: {} },
		},
		"/users/{notid}/action": {
			GET: { handler: () => Response.error(), definition: {} },
		},
		"/users/{id}/comments/{comment}": {
			GET: { handler: () => Response.error(), definition: {} },
		},
	});
	assertObjectMatch(
		rst[0],
		{
			kind: "const",
			value: "login",
			children: [
				{
					kind: "handler",
					definition: {
						GET: {},
					},
				},
			],
		},
	);
	assertObjectMatch(
		rst[1],
		{
			kind: "const",
			value: "users",
			children: [
				{
					kind: "param",
					name: "id",
					children: [
						{
							kind: "const",
							value: "comments",
							children: [
								{
									kind: "param",
									name: "comment",
									children: [
										{
											kind: "handler",
											definition: {
												GET: {},
											},
										},
									],
								},
							],
						},
						{
							kind: "handler",
							definition: {
								GET: {},
								POST: {},
							},
						},
					],
				},
				{
					kind: "param",
					name: "notid",
					children: [
						{
							kind: "const",
							value: "action",
							children: [
								{
									kind: "handler",
									definition: {
										GET: {},
									},
								},
							],
						},
					],
				},
			],
		},
	);
});
