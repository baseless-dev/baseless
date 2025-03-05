import { Register } from "./app.ts";
import { Document, DocumentGetOptions, DocumentListEntry, DocumentListOptions } from "@baseless/core/document";
import { KVProvider } from "./provider.ts";
import { Identity, IdentityChannel } from "@baseless/core/identity";
import { Notification } from "@baseless/core/notification";

export interface ServiceCollection {
	document: RegisteredDocumentService;
	notification: NotificationService;
	pubsub: RegisteredPubSubService;
	kv: KVService;
}

export interface KVService extends KVProvider {}

export interface NotificationService {
	notify(identityId: Identity["id"], notification: Notification, signal?: AbortSignal): Promise<boolean>;
	notifyChannel(identityId: Identity["id"], channel: string, notification: Notification, signal?: AbortSignal): Promise<boolean>;
	unsafeNotifyChannel(identityChannel: IdentityChannel, notification: Notification, signal?: AbortSignal): Promise<boolean>;
}

// deno-fmt-ignore
export type RegisteredDocumentService = Register extends { documentGet: infer TGet; documentGetMany: infer TGetMany, documentList: infer TList }
	? { get: TGet; getMany: TGetMany; list: TList, atomic: () => RegisteredDocumentServiceAtomic }
	: AnyDocumentService;

export type RegisteredDocumentServiceAtomic = Register extends
	{ documentAtomicCheck: infer TCheck; documentAtomicSet: infer TSet; documentAtomicDelete: infer TDelete }
	? { check: TCheck; set: TSet; delete: TDelete; commit: AnyDocumentAtomicService["commit"] }
	: AnyDocumentAtomicService;

// deno-fmt-ignore
export type RegisteredPubSubService = Register extends { pubSubPublish: infer TPublish, pubSubSubscribe: infer TSubscribe }
	? { publish: TPublish; subscribe: TSubscribe }
	: AnyPubSubService;

export interface AnyDocumentService {
	get(key: string, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Document>;
	getMany(keys: Array<string>, options?: DocumentGetOptions, signal?: AbortSignal): Promise<Array<Document>>;
	list(options: DocumentListOptions, signal?: AbortSignal): ReadableStream<DocumentListEntry>;
	atomic(): AnyDocumentAtomicService;
}

export interface AnyDocumentAtomicService {
	check(key: string, versionstamp: string | null): AnyDocumentAtomicService;
	set(key: string, data: unknown): AnyDocumentAtomicService;
	delete(key: string): AnyDocumentAtomicService;
	commit(signal?: AbortSignal): Promise<void>;
}

export interface AnyPubSubService {
	publish(key: string, payload: unknown, signal?: AbortSignal): Promise<void>;
}
