import { assertEquals } from "https://deno.land/std@0.126.0/testing/asserts.ts";
import { DatabaseBuilder, DatabasePermissions } from "./database.ts";

Deno.test("collection ref", () => {
	const builder = new DatabaseBuilder();
	builder.collection("/foo");
	assertEquals({
		collections: [{
			ref: "/foo",
			matcher: /^\/foo$/,
			onCreate: undefined,
			permission: undefined,
		}],
		documents: [],
	}, builder.build());
});

Deno.test("collection permission", () => {
	const builder = new DatabaseBuilder();
	builder.collection("/foo").permission(DatabasePermissions.List);
	assertEquals({
		collections: [{
			ref: "/foo",
			matcher: /^\/foo$/,
			onCreate: undefined,
			permission: DatabasePermissions.List,
		}],
		documents: [],
	}, builder.build());
});

Deno.test("collection on create", () => {
	const builder = new DatabaseBuilder();
	const callback = () => Promise.resolve();
	builder.collection("/foo").onCreate(callback);
	assertEquals({
		collections: [{
			ref: "/foo",
			matcher: /^\/foo$/,
			onCreate: callback,
			permission: undefined,
		}],
		documents: [],
	}, builder.build());
});

Deno.test("document ref", () => {
	const builder = new DatabaseBuilder();
	builder.document("/foo/:bar");
	assertEquals({
		collections: [],
		documents: [{
			ref: "/foo/:bar",
			matcher: /^\/foo\/(?<bar>[^/]+)$/,
			onUpdate: undefined,
			onDelete: undefined,
			permission: undefined,
		}],
	}, builder.build());
});

Deno.test("document permission", () => {
	const builder = new DatabaseBuilder();
	builder.document("/foo/:bar").permission(DatabasePermissions.Get);
	assertEquals({
		collections: [],
		documents: [{
			ref: "/foo/:bar",
			matcher: /^\/foo\/(?<bar>[^/]+)$/,
			onUpdate: undefined,
			onDelete: undefined,
			permission: DatabasePermissions.Get,
		}],
	}, builder.build());
});

Deno.test("document on update", () => {
	const builder = new DatabaseBuilder();
	const callback = () => Promise.resolve();
	builder.document("/foo/:bar").onUpdate(callback);
	assertEquals({
		collections: [],
		documents: [{
			ref: "/foo/:bar",
			matcher: /^\/foo\/(?<bar>[^/]+)$/,
			onUpdate: callback,
			onDelete: undefined,
			permission: undefined,
		}],
	}, builder.build());
});

Deno.test("document on delete", () => {
	const builder = new DatabaseBuilder();
	const callback = () => Promise.resolve();
	builder.document("/foo/:bar").onDelete(callback);
	assertEquals({
		collections: [],
		documents: [{
			ref: "/foo/:bar",
			matcher: /^\/foo\/(?<bar>[^/]+)$/,
			onUpdate: undefined,
			onDelete: callback,
			permission: undefined,
		}],
	}, builder.build());
});
