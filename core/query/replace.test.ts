import { BatchableStatementBuilder } from "./builder.ts";
import { assert, assertEquals } from "@std/assert";
import { replace } from "./replace.ts";
import { queryToString } from "./visit.test.ts";

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

Deno.test("replace", () => {
	const a1 = q.select("posts", "p")
		.pick((q) => ({
			title: q.ref("p", "title"),
		}))
		.build();

	const r1 = replace(a1, (node) => {
		return node;
	});
	const r2 = replace(a1, (node) => {
		if (node.type === "select") {
			const operands = [{
				type: "booleancomparison",
				operator: "=",
				left: {
					type: "columnref",
					table: node.from.alias ?? node.from.table,
					column: "author",
				},
				right: {
					type: "literal",
					data: "123",
				},
			}];
			return {
				...node,
				where: {
					type: "booleanexpression",
					operator: "and",
					operands: node.where ? [...operands, node.where] : operands,
				},
			};
		}
		return node;
	});

	assertEquals(queryToString(a1), `SELECT p.title AS title FROM posts AS p`);
	assertEquals(a1, r1);
	assertEquals(queryToString(r2), `SELECT p.title AS title FROM posts AS p WHERE p.author = "123"`);
});
