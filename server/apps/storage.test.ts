import { app, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import createMemoryServer from "../server.test.ts";
import { StorageListEntry, StorageObject, StorageSignedUrl } from "@baseless/core/storage";
import { ForbiddenError, StorageFolderNotFoundError, StorageObjectNotFoundError } from "@baseless/core/errors";
import storageApp from "./storage.ts";

Deno.test("Storage application", async (t) => {
	using mock = await createMemoryServer({
		app: app()
			.extend(storageApp)
			.file({
				path: "avatar",
				fileSecurity: () => Permission.All,
			})
			.folder({
				path: "uploads",
				folderSecurity: () => Permission.All,
				fileSecurity: () => Permission.All,
			})
			.folder({
				path: "readonly",
				folderSecurity: () => Permission.Get | Permission.List,
				fileSecurity: () => Permission.Get,
			})
			.file({
				path: "constrained",
				fileSecurity: () => Permission.All,
				conditions: {
					"content-type": "image/png,image/jpeg",
					"content-length-range": "0-5242880",
				},
			})
			.folder({
				path: "constrained-folder",
				folderSecurity: () => Permission.All,
				fileSecurity: () => Permission.All,
				conditions: {
					"content-type": "application/pdf",
					"content-length-range": "1048576",
				},
			})
			.build(),
		configuration: {},
	});

	await t.step("get-metadata for missing file returns not-found error", async () => {
		await assertRejects(
			() => mock.fetch("/storage/get-metadata", { data: { path: "avatar" } }),
			StorageObjectNotFoundError,
		);
	});

	await t.step("upload-url returns a signed URL", async () => {
		const resp = await mock.fetch("/storage/upload-url", {
			data: { path: "avatar", options: { contentType: "image/png", metadata: { userId: "u1" } } },
			schema: z.object({ url: StorageSignedUrl() }),
		});
		assertEquals(typeof resp.url.url, "string");
		assertEquals(typeof resp.url.expiresAt, "string");
	});

	await t.step("get-metadata succeeds after upload-url", async () => {
		const resp = await mock.fetch("/storage/get-metadata", {
			data: { path: "avatar" },
			schema: z.object({ object: StorageObject() }),
		});
		assertEquals(resp.object.key, "avatar");
		assertEquals(resp.object.contentType, "image/png");
	});

	await t.step("download-url returns a signed URL", async () => {
		const resp = await mock.fetch("/storage/download-url", {
			data: { path: "avatar" },
			schema: z.object({ url: StorageSignedUrl() }),
		});
		assertEquals(typeof resp.url.url, "string");
	});

	await t.step("delete removes the file", async () => {
		const resp = await mock.fetch("/storage/delete", {
			data: { path: "avatar" },
			schema: z.object({ result: z.boolean() }),
		});
		assertEquals(resp.result, true);

		await assertRejects(
			() => mock.fetch("/storage/get-metadata", { data: { path: "avatar" } }),
			StorageObjectNotFoundError,
		);
	});

	await t.step("upload-url for folder file", async () => {
		const resp = await mock.fetch("/storage/upload-url", {
			data: { path: "uploads/photo1.jpg", options: { contentType: "image/jpeg" } },
			schema: z.object({ url: StorageSignedUrl() }),
		});
		assertEquals(typeof resp.url.url, "string");
	});

	await t.step("upload-url for another folder file", async () => {
		await mock.fetch("/storage/upload-url", {
			data: { path: "uploads/photo2.jpg", options: { contentType: "image/jpeg" } },
			schema: z.object({ url: StorageSignedUrl() }),
		});
	});

	await t.step("list files in folder", async () => {
		const resp = await mock.fetch("/storage/list", {
			data: { options: { prefix: "uploads" } },
			schema: z.object({ entries: z.array(StorageListEntry()) }),
		});
		assertEquals(resp.entries.length, 2);
	});

	await t.step("list on undefined folder returns not-found", async () => {
		await assertRejects(
			() => mock.fetch("/storage/list", { data: { options: { prefix: "nonexistent" } } }),
			StorageFolderNotFoundError,
		);
	});

	await t.step("get-metadata on unregistered path returns not-found", async () => {
		await assertRejects(
			() => mock.fetch("/storage/get-metadata", { data: { path: "random/file" } }),
			StorageObjectNotFoundError,
		);
	});

	await t.step("delete on readonly folder is forbidden", async () => {
		// First, seed a file via the provider directly
		await mock.provider.storage.put(
			"readonly/secret.txt",
			new TextEncoder().encode("hello").buffer,
			{ contentType: "text/plain" },
		);

		await assertRejects(
			() => mock.fetch("/storage/delete", { data: { path: "readonly/secret.txt" } }),
			ForbiddenError,
		);
	});

	await t.step("upload-url on readonly folder is forbidden", async () => {
		await assertRejects(
			() => mock.fetch("/storage/upload-url", { data: { path: "readonly/new.txt" } }),
			ForbiddenError,
		);
	});

	await t.step("download-url on readonly folder succeeds", async () => {
		const resp = await mock.fetch("/storage/download-url", {
			data: { path: "readonly/secret.txt" },
			schema: z.object({ url: StorageSignedUrl() }),
		});
		assertEquals(typeof resp.url.url, "string");
	});

	await t.step("upload-url on constrained file returns a signed URL", async () => {
		const resp = await mock.fetch("/storage/upload-url", {
			data: { path: "constrained", options: { contentType: "image/png" } },
			schema: z.object({ url: StorageSignedUrl() }),
		});
		assertEquals(typeof resp.url.url, "string");
		assertEquals(typeof resp.url.expiresAt, "string");
	});

	await t.step("upload-url on constrained folder file returns a signed URL", async () => {
		const resp = await mock.fetch("/storage/upload-url", {
			data: { path: "constrained-folder/doc.pdf", options: { contentType: "application/pdf" } },
			schema: z.object({ url: StorageSignedUrl() }),
		});
		assertEquals(typeof resp.url.url, "string");
		assertEquals(typeof resp.url.expiresAt, "string");
	});
});
