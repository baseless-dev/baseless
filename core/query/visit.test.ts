import { BatchableStatementBuilder } from "./builder.ts";
import { assertEquals } from "@std/assert";
import { visit } from "./visit.ts";

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

Deno.test("queryToString", () => {
	const a3 = q
		.insert("posts")
		.columns("title", "content", "postDate", "author_id")
		.from((q) =>
			q.select("posts", "p")
				.where((q) => q.equal(q.ref("p", "author_id"), q.param("author_id")))
				.pick((q) => ({
					title: q.ref("p", "title"),
					content: q.ref("p", "content"),
					postDate: q.ref("p", "postDate"),
					author_id: q.ref("p", "author_id"),
				}))
		);

	const a4 = q
		.insert("posts")
		.columns("title", "content", "postDate", "author_id")
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
	const sql = queryToString(a5.build());
	assertEquals(
		sql,
		`BATCH (CHECK (SELECT  FROM posts AS p WHERE p.title eq :title) THEN INSERT INTO posts (title, content, postDate, author_id) SELECT p.title AS title, p.content AS content, p.postDate AS postDate, p.author_id AS author_id FROM posts AS p WHERE p.author_id eq :author_id; INSERT INTO posts (title, content, postDate, author_id) VALUES (:title, :content, :date, :author))`,
	);
});

export function queryToString(query: any): string {
	return visit<string>(query, {
		visitLiteral: (node) => JSON.stringify(node.data),
		visitNamedFunctionReference: (node, visit) => `${node.name}(${node.params.map(visit).join(", ")})`,
		visitTableReference: (node) => `${node.table}${node.alias ? ` AS ${node.alias}` : ""}`,
		visitColumnReference: (node) => `${node.table}.${node.column}`,
		visitNamedParamReference: (node) => `:${node.param}`,
		visitBooleanExpression: (node, visit) => node.operands.map((o) => visit(o)).join(` ${node.operator} `),
		visitBooleanComparisonExpression: (node, visit) => `${visit(node.left)} ${node.operator} ${visit(node.right)}`,
		visitSelectStatement: (node, visit) =>
			`SELECT ${Object.entries(node.select).map(([key, value]) => `${visit(value)} AS ${key}`).join(", ")} FROM ${visit(node.from)}${
				node.where ? ` WHERE ${visit(node.where)}` : ""
			}${node.groupBy.length ? ` GROUP BY ${node.groupBy.map((g) => visit(g.column)).join(", ")}` : ""}${
				node.orderBy.length ? ` ORDER BY ${node.orderBy.map((o) => `${visit(o.column)} ${o.order}`).join(", ")}` : ""
			}${node.limit ? ` LIMIT ${node.limit}` : ""}${node.offset ? ` OFFSET ${node.offset}` : ""}`,
		visitInsertStatement: (node, visit) => {
			if (node.values) {
				return `INSERT INTO ${visit(node.into)} (${node.columns.join(", ")}) VALUES ${
					node.values.map((v) => `(${Object.values(v).map((v) => visit(v)).join(", ")})`).join(", ")
				}`;
			} else {
				return `INSERT INTO ${visit(node.into)} (${node.columns.join(", ")}) ${visit(node.from!)}`;
			}
		},
		visitUpdateStatement: (node, visit) =>
			`UPDATE ${visit(node.table)} SET ${Object.entries(node.set).map(([key, value]) => `${key} = ${visit(value)}`).join(", ")}${
				node.join.map((j) => visit(j)).join(" ")
			}${node.where ? ` WHERE ${visit(node.where)}` : ""}${node.limit ? ` LIMIT ${node.limit}` : ""}`,
		visitDeleteStatement: (node, visit) =>
			`DELETE FROM ${visit(node.table)}${node.join.map((j) => visit(j)).join(" ")}${node.where ? ` WHERE ${visit(node.where)}` : ""}${
				node.limit ? ` LIMIT ${node.limit}` : ""
			}`,
		visitBatchStatement: (node, visit) =>
			`BATCH (${node.checks.map((c) => visit(c)).join(" AND ")} THEN ${node.statements.map((s) => visit(s)).join("; ")})`,
		visitJoinFragment: (node, visit) =>
			`JOIN ${node.table}${node.alias ? ` AS ${node.alias}` : ""}${node.on ? `ON ${visit(node.on)}` : ""}`,
		visitCheck: (node, visit) => `CHECK (${visit(node.select)})`,
	}) ?? "";
}
