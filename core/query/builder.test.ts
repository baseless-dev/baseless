import { assertEquals } from "@std/assert/equals";
import { assert } from "@std/assert/assert";
import { BatchableStatementBuilder } from "./builder.ts";
import { TStatement } from "./schema.ts";
import * as z from "../schema.ts";

type User = {
	user_id: number;
	display: string;
	email: string;
	age: number;
};

type InsertUser = Omit<User, "user_id">;

type Post = {
	post_id: number;
	title: string;
	content: string;
	postDate: Date;
	author_id: number;
};

type InsertPost = Omit<Post, "post_id">;

type Tables = {
	users: User;
	posts: Post;
};

type InsertTables = {
	users: InsertUser;
	posts: InsertPost;
};

const q = new BatchableStatementBuilder<Tables, InsertTables>();

Deno.test("SELECT with JOIN produces a valid TStatement", () => {
	const a1 = q
		.select("posts", "p")
		.join("users", "u", (q) => q.equal(q.ref("u", "user_id"), q.ref("p", "author_id")))
		.map((q) => ({
			post_id: q.ref("p", "post_id"),
			post_title: q.ref("p", "title"),
			post_content: q.ref("p", "content"),
			post_postDate: q.ref("p", "postDate"),
			author_id: q.ref("u", "user_id"),
			author_display: q.ref("u", "display"),
			author_email: q.ref("u", "email"),
			foo: q.param("foo"),
		}))
		.where((q) => q.equal(q.ref("u", "user_id"), q.param("poil")))
		.limit(10);

	const s1 = a1.toStatement();
	const result = z.safeParse(TStatement, s1);
	assert(result.success, `SELECT+JOIN statement failed validation: ${JSON.stringify(result)}`);
	assertEquals(s1.type, "statement");
	assertEquals(s1.statement.type, "select");
});

Deno.test("simple SELECT produces a valid TStatement", () => {
	const a2 = q.select("posts", "p")
		.map((q) => ({
			title: q.ref("p", "title"),
			content: q.ref("p", "content"),
			postDate: q.ref("p", "postDate"),
		}))
		.limit(1);

	const s2 = a2.toStatement();
	const result = z.safeParse(TStatement, s2);
	assert(result.success, `Simple SELECT statement failed validation: ${JSON.stringify(result)}`);
	assertEquals(s2.statement.type, "select");
});

Deno.test("INSERT FROM SELECT produces a valid TStatement", () => {
	const a3 = q
		.insert("posts")
		.from((q) =>
			q.select("posts", "p")
				.where((q) => q.equal(q.ref("p", "author_id"), q.param("author_id")))
				.map((q) => ({
					title: q.ref("p", "title"),
					content: q.ref("p", "content"),
					postDate: q.ref("p", "postDate"),
					author_id: q.ref("p", "author_id"),
				}))
		);

	const s3 = a3.toStatement();
	const result = z.safeParse(TStatement, s3);
	assert(result.success, `INSERT FROM SELECT statement failed validation: ${JSON.stringify(result)}`);
	assertEquals(s3.statement.type, "insert");
});

Deno.test("INSERT VALUES produces a valid TStatement", () => {
	const a4 = q
		.insert("posts")
		.values((q) => ({
			title: q.param("title"),
			content: q.param("content"),
			postDate: q.param("date"),
			author_id: q.param("author"),
		}));

	const s4 = a4.toStatement();
	const result = z.safeParse(TStatement, s4);
	assert(result.success, `INSERT VALUES statement failed validation: ${JSON.stringify(result)}`);
	assertEquals(s4.statement.type, "insert");
});

Deno.test("BATCH produces a valid TStatement", () => {
	const a3 = q
		.insert("posts")
		.from((q) =>
			q.select("posts", "p")
				.where((q) => q.equal(q.ref("p", "author_id"), q.param("author_id")))
				.map((q) => ({
					title: q.ref("p", "title"),
					content: q.ref("p", "content"),
					postDate: q.ref("p", "postDate"),
					author_id: q.ref("p", "author_id"),
				}))
		);

	const a4 = q
		.insert("posts")
		.values((q) => ({
			title: q.param("title"),
			content: q.param("content"),
			postDate: q.param("date"),
			author_id: q.param("author"),
		}));

	const a5 = q
		.batch()
		.checkIfNotExists(q.select("posts", "p").where((q) => q.equal(q.ref("p", "title"), q.param("title"))))
		.execute(a3)
		.execute(a4);

	const s5 = a5.toStatement();
	const result = z.safeParse(TStatement, s5);
	assert(result.success, `BATCH statement failed validation: ${JSON.stringify(result)}`);
	assertEquals(s5.statement.type, "batch");
});
