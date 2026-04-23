import { assertEquals } from "@std/assert/equals";
import { assert } from "@std/assert/assert";
import * as z from "../schema.ts";
import { RootQueryBuilder } from "./builder.ts";
import { TStatement } from "./schema.ts";

type Models = {
	users: {
		id: number;
		name: string;
	};
	posts: {
		id: number;
		title: string;
		content: string;
		postedAt: Date;
		authorId: number;
	};
};

type InsertModels = {
	users: Omit<Models["users"], "id">;
	posts: Omit<Models["posts"], "id">;
};

Deno.test("builder", async (t) => {
	await t.step("SELECT serializes to a valid TStatement", () => {
		const q = new RootQueryBuilder<Models>();
		const statement = q
			.selectFrom("posts", "p")
			.innerJoin("users", "u", (expr) => expr.eq("u.id", "p.authorId"))
			.select((expr) => [
				"p.id",
				"p.title",
				"p.postedAt",
				expr.column("u.name").as("authorName"),
				expr.literal(42).as("answer"),
			])
			.where((expr) => expr.eq("p.postedAt", expr.param("since")))
			.groupBy(["u.id"])
			.having(".title", "notLike", "%Test%")
			.orderBy((expr) => [expr.column("p.postedAt").desc(), "p.title"])
			.limit(1)
			.toStatement();

		const result = z.safeParse(TStatement, statement);
		assert(result.success, `builder2 statement failed validation: ${JSON.stringify(result)}`);
		assertEquals(statement.statement.type, "select");
		if (statement.statement.type !== "select") {
			throw new Error("Expected a SELECT statement.");
		}
		assertEquals(statement.statement.join[0]?.joinType, "inner");
		assertEquals(statement.statement.where?.type, "booleancomparison");
		assertEquals(statement.statement.having?.type, "booleancomparison");
		assertEquals(statement.statement.orderBy[0]?.order, "DESC");
		assertEquals(statement.statement.select.answer, { type: "literal", data: 42 });
	});

	await t.step("BATCH serializes to a valid TStatement", () => {
		const q = new RootQueryBuilder<Models, InsertModels>();
		const insert = q.insertInto("posts").values((expr) => ({
			title: expr.param("title"),
			content: expr.param("content"),
			postedAt: expr.param("postedAt"),
			authorId: expr.param("authorId"),
		}));
		const remove = q.deleteFrom("posts")
			.where((expr) => expr.eq("posts.title", expr.param("oldTitle")))
			.limit(1);
		const statement = q.batch()
			.checkIfNotExists(q.selectFrom("posts", "p").where((expr) => expr.eq("p.title", expr.param("title"))))
			.execute(insert)
			.execute(remove)
			.toStatement();

		const result = z.safeParse(TStatement, statement);
		assert(result.success, `builder2 batch statement failed validation: ${JSON.stringify(result)}`);
		assertEquals(statement.statement.type, "batch");
		if (statement.statement.type !== "batch") {
			throw new Error("Expected a BATCH statement.");
		}
		assertEquals(statement.statement.checks[0]?.type, "not_exists");
		assertEquals(statement.statement.statements[0]?.type, "insert");
		assertEquals(statement.statement.statements[1]?.type, "delete");
	});
});
