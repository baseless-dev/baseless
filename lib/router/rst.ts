import {
	type Definition,
	type Handler,
	isRouteSegmentSimilar,
	type Method,
	type Routes,
	type RouteSegment,
	RouteSegmentHandler,
	RouteSegmentParam,
} from "./types.ts";

export class RestParameterNotLastError extends Error {
	constructor() {
		super("Rest parameter must be the last segment");
	}
}

export function parseRST(
	routes: Routes,
): RouteSegment[] {
	const routeSegments = mergeSegments(routes.map((route) => {
		const segments = route.path.replace(/(^\/*|\/*$)/, "").split("/");
		return parseSegment(
			segments,
			route.method,
			route.handler,
			route.definition,
		);
	}));
	return routeSegments;
}

function parseSegment(
	segments: string[],
	method: Method,
	handler: Handler,
	// deno-lint-ignore no-explicit-any
	definition: Definition<any, any, any, any>,
): RouteSegment {
	if (segments.length === 0) {
		return {
			kind: "handler",
			operations: { [method]: { handler, definition } },
		};
	} else if (segments[0].startsWith("{...") && segments[0].endsWith("}")) {
		const name = segments[0].slice(4, -1);
		if (segments.length > 1) {
			throw new RestParameterNotLastError();
		}
		return {
			kind: "rest",
			name,
			children: [{
				kind: "handler",
				operations: { [method]: { handler, definition } },
			}],
		};
	} else if (segments[0].startsWith("{") && segments[0].endsWith("}")) {
		const name = segments[0].slice(1, -1);
		return {
			kind: "param",
			name,
			children: [
				parseSegment(segments.slice(1), method, handler, definition),
			],
		};
	}
	return {
		kind: "const",
		value: segments[0],
		children: [
			parseSegment(segments.slice(1), method, handler, definition),
		],
	};
}

function mergeSegments(segments: RouteSegment[]): RouteSegment[] {
	const merged: RouteSegment[] = [];
	for (const segment of segments) {
		const existingSegment = merged
			.find((s) => isRouteSegmentSimilar(s, segment));
		if (!existingSegment) {
			merged.push(segment);
		} else if (
			existingSegment.kind === "handler" && segment.kind === "handler"
		) {
			Object.assign(
				existingSegment.operations,
				(segment as RouteSegmentHandler).operations,
			);
		} else {
			(existingSegment as RouteSegmentParam).children = mergeSegments([
				...(existingSegment as RouteSegmentParam).children,
				...(segment as RouteSegmentParam).children,
			]);
		}
	}
	merged.sort(routeSegmentSorter);
	return merged;
}

export function routeSegmentSorter(a: RouteSegment, b: RouteSegment): number {
	const ka = a.kind === "const"
		? `0:${a.value}`
		: a.kind === "param"
		? `1:${a.name}`
		: a.kind === "rest"
		? `2:${a.name}`
		: `3`;
	const kb = b.kind === "const"
		? `0:${b.value}`
		: b.kind === "param"
		? `1:${b.name}`
		: b.kind === "rest"
		? `2:${b.name}`
		: `3`;
	return ka.localeCompare(kb);
}
