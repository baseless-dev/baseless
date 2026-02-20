// import { BatchableStatementBuilder, BooleanExpressionBuilder, ReferenceOrLiteralBuilder, StatementBuilder } from "./builder.ts";
// import { validate } from "../schema.ts";
// import { TStatement } from "./schema.ts";

// type User = {
// 	user_id: number;
// 	display: string;
// 	email: string;
// 	age: number;
// };

// type InsertUser = Omit<User, "user_id">;

// type Post = {
// 	post_id: number;
// 	title: string;
// 	content: string;
// 	postDate: Date;
// 	author_id: number;
// };

// type InsertPost = Omit<Post, "post_id">;

// type Tables = {
// 	users: User;
// 	posts: Post;
// };

// type InsertTables = {
// 	users: InsertUser;
// 	posts: InsertPost;
// };

// const q = new BatchableStatementBuilder<Tables, InsertTables>();

// const a1 = q
// 	.select("posts", "p")
// 	.join("users", "u", (q) => q.equal(q.ref("u", "user_id"), q.ref("p", "author_id")))
// 	.pick((q) => ({
// 		post_id: q.ref("p", "post_id"),
// 		post_title: q.ref("p", "title"),
// 		post_content: q.ref("p", "content"),
// 		post_postDate: q.ref("p", "postDate"),
// 		author_id: q.ref("u", "user_id"),
// 		author_display: q.ref("u", "display"),
// 		author_email: q.ref("u", "email"),
// 		foo: q.param("foo"),
// 	}))
// 	.where((q) => q.equal(q.ref("u", "user_id"), q.param("poil")))
// 	.limit(10);

// const a2 = q.select("posts", "p")
// 	.pick((q) => ({
// 		title: q.ref("p", "title"),
// 		content: q.ref("p", "content"),
// 		postDate: q.ref("p", "postDate"),
// 		// author_id: q.param("author_id"),
// 	}))
// 	.limit(1);

// const a3 = q
// 	.insert("posts")
// 	.from((q) =>
// 		q.select("posts", "p")
// 			.where((q) => q.equal(q.ref("p", "author_id"), q.param("author_id")))
// 			.pick((q) => ({
// 				title: q.ref("p", "title"),
// 				content: q.ref("p", "content"),
// 				postDate: q.ref("p", "postDate"),
// 				author_id: q.ref("p", "author_id"),
// 			}))
// 	);

// const a4 = q
// 	.insert("posts")
// 	.values((q) => ({
// 		title: q.param("title"),
// 		content: q.param("content"),
// 		postDate: q.param("date"),
// 		author_id: q.param("author"),
// 	}));

// const a5 = q
// 	.batch()
// 	.checkIfNotExists(q.select("posts", "p").where((q) => q.equal(q.ref("p", "title"), q.param("title"))))
// 	.execute(a3)
// 	.execute(a4);

// const s1: unknown = a1.toStatement();
// const s2: unknown = a2.toStatement();
// const s3: unknown = a3.toStatement();
// const s4: unknown = a4.toStatement();
// const s5: unknown = a5.toStatement();
// const errors = [] as any[];

// errors.splice(0);
// if (!validate(TStatement, s1, errors)) {
// 	console.log({ s1, errors });
// }

// errors.splice(0);
// if (!validate(TStatement, s2, errors)) {
// 	console.log({ s2, errors });
// }

// errors.splice(0);
// if (!validate(TStatement, s3, errors)) {
// 	console.log({ s3, errors });
// }

// errors.splice(0);
// if (!validate(TStatement, s4, errors)) {
// 	console.log({ s4, errors });
// }

// errors.splice(0);
// if (!validate(TStatement, s5, errors)) {
// 	console.log({ s5, errors });
// }
