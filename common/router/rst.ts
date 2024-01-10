import {
	type Definition,
	type Handler,
	isRouteSegmentSimilar,
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
	return mergeSegments(
		Object.entries(routes).flatMap(([path, methods]) => {
			const segments = path.replace(/(^\/*|\/*$)/, "").split("/");
			return Object.entries(methods).map((
				[method, { handler, definition }],
			) => parseSegment(segments, method, handler, definition));
		}),
	);
}

function parseSegment(
	segments: string[],
	method: string,
	handler: Handler,
	definition: Definition,
): RouteSegment {
	if (segments.length === 0) {
		return {
			kind: "handler",
			definition: { [method]: { handler, definition } },
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
				definition: { [method]: { handler, definition } },
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
				existingSegment.definition,
				(segment as RouteSegmentHandler).definition,
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
	if (a.kind === "const" && b.kind === "const") {
		return a.value.localeCompare(b.value);
	} else if (a.kind === "param" && b.kind === "param") {
		return a.name.localeCompare(b.name);
	} else if (a.kind === "handler" && b.kind === "handler") {
		return 0;
	} else if (a.kind === "handler") {
		return 1;
	} else if (b.kind === "handler") {
		return -1;
	} else if (a.kind === "param" && b.kind === "const") {
		return 1;
	} else if (a.kind === "const" && b.kind === "param") {
		return -1;
	}
	return 0;
}
