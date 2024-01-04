import {
	type Handler,
	isRouteSegmentSimilar,
	type Routes,
	type RouteSchema,
	type RouteSegment,
} from "./types.ts";

export function parseRST(
	routes: Routes,
): RouteSegment[] {
	return mergeSegments(
		Object.entries(routes).flatMap(([path, methods]) => {
			const segments = path.replace(/(^\/*|\/*$)/, "").split("/");
			return Object.entries(methods).map((
				[method, { handler, schemas }],
			) => parseSegment(segments, method, handler, schemas));
		}),
	);
}

function parseSegment(
	segments: string[],
	method: string,
	handler: Handler,
	schemas: RouteSchema,
	inOptional = false,
): RouteSegment {
	if (segments.length === 0) {
		return {
			kind: "handler",
			methods: { [method]: { handler, schemas } },
		};
	} else if (segments[0].startsWith(":")) {
		const optional = segments[0].endsWith("?");
		const name = segments[0].slice(1).substring(
			0,
			optional ? segments[0].length - 2 : undefined,
		);
		if (inOptional && !optional) {
			throw new NonOptionalSegmentAfterOptionalSegmentError();
		}
		return {
			kind: "param",
			name,
			optional,
			children: [
				parseSegment(segments.slice(1), method, handler, schemas, optional),
			] as any[],
		};
	}
	if (inOptional) {
		throw new NonOptionalSegmentAfterOptionalSegmentError();
	}
	return {
		kind: "const",
		value: segments[0],
		children: [
			parseSegment(segments.slice(1), method, handler, schemas, false),
		],
	};
}

export class NonOptionalSegmentAfterOptionalSegmentError extends Error {
	constructor() {
		super("Non-optional segment after optional segment");
	}
}

function mergeSegments(segments: RouteSegment[]): RouteSegment[] {
	const merged: RouteSegment[] = [];
	for (const segment of segments) {
		const existingSegment = merged
			.find((s) => isRouteSegmentSimilar(s, segment));
		if (!existingSegment) {
			merged.push(segment);
		} else if (
			existingSegment.kind === "handler" &&
			segment.kind === "handler"
		) {
			Object.assign(existingSegment.methods, segment.methods);
		} else if (
			existingSegment.kind !== "handler" &&
			segment.kind !== "handler"
		) {
			existingSegment.children = mergeSegments([
				...existingSegment.children,
				...segment.children,
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
		return -1;
	} else if (a.kind === "const" && b.kind === "param") {
		return 1;
	}
	return 0;
}
