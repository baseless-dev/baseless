import { createClient } from "@libsql/client/node";
import { LibSQLTableProvider } from "./table.ts";
import { testTableProvider } from "../../server/provider.test.ts";

Deno.test("LibSQLTableProvider", async (t) => {
	const client = createClient({ url: "file::memory:" });
	await client.executeMultiple(`
		CREATE TABLE users (
			user_id INTEGER PRIMARY KEY AUTOINCREMENT,
			display TEXT NOT NULL,
			email TEXT NOT NULL,
			age INTEGER NOT NULL
		);
		CREATE TABLE posts (
			post_id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			content TEXT NOT NULL,
			author_id INTEGER NOT NULL,
			FOREIGN KEY (author_id) REFERENCES users(user_id)
		);
	`);
	const provider = new LibSQLTableProvider(client);
	await testTableProvider(provider, t);
});
