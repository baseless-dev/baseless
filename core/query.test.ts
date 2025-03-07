import type { PreparedQuery, QueryBuilder } from "./query.ts";

type DataProvider = {
	run<TModel extends {}, TParams extends {}>(query: PreparedQuery<TModel, TParams>, params: TParams): Promise<TModel>;
};

type User = {
	user_id: number;
	display: string;
	email: string;
	age: number;
};

type Post = {
	post_id: number;
	title: string;
	content: string;
	postDate: Date;
	author_id: number;
};

declare const query: QueryBuilder<{ users: User; posts: Post }, {}, {}>;
declare const context: { tables: DataProvider };

const getPostByID = query
	.from("posts", "p")
	.join("users", "a", (q) => q.eq(q.ref("a", "user_id"), q.ref("p", "author_id")))
	.where((q) => q.eq(q.ref("p", "post_id"), q.param("post_id")))
	.select((q) => ({
		post_id: q.ref("p", "post_id"),
		author_id: q.ref("p", "author_id"),
		title: q.ref("p", "title"),
		content: q.concat(q.param("content_prefix"), q.ref("p", "content"), q.param("content_suffix")),
		postDate: q.ref("p", "postDate"),
	}))
	.offset(0)
	.limit(1)
	.prepare();

const result = await context.tables.run(getPostByID, { post_id: 42, content_prefix: "", content_suffix: "!" });

console.log(result);
