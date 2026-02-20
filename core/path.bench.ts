import { id } from "./id.ts";
import { matchPath, matchPathRegex, matchPathTrie } from "./path.ts";

const routes = [
	{ path: "/user" },
	{ path: "/user/comments" },
	{ path: "/user/avatar" },
	{ path: "/user/lookup/username/:username" },
	{ path: "/user/lookup/email/:address" },
	{ path: "/event/:id" },
	{ path: "/event/:id/comments" },
	{ path: "/event/:id/comment" },
	{ path: "/map/:location/events" },
	{ path: "/very/deeply/nested/route/hello/there" },
];

for (let i = 0; i < 4; ++i) {
	for (const fn of [matchPathRegex, matchPathTrie, matchPath]) {
		const count = (Math.pow(2, i) >> 0) - 1;
		const data: Array<typeof routes[number]> = [];
		for (let j = 0; j < count; ++j) {
			for (let k = 0; k < routes.length; ++k) {
				data.push({ path: `/test/${id()}/${routes[k].path}` });
			}
		}
		data.push(...routes);
		const matcher = fn(data);
		Deno.bench(fn.name, { group: `${data.length} routes`, baseline: fn.name === "matchPath" }, () => {
			for (const route of routes) {
				Array.from(matcher(route.path));
			}
		});
	}
}
