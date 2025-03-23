// deno-lint-ignore-file no-explicit-any
import type { Matcher } from "@baseless/core/path";
import { TopicNotFoundError } from "@baseless/core/topic";
import type { Auth, RegisteredContext, TCollection, TDocument, TOnDocumentDeleting, TOnDocumentSetting, TTopic } from "./app.ts";
import { assert } from "@baseless/core/schema";
import {
	DocumentAtomic,
	DocumentProvider,
	KVProvider,
	NotificationChannelProvider,
	QueueProvider,
	RateLimiterProvider,
	RateLimiterProviderLimitOptions,
} from "./provider.ts";
import type { KVGetOptions, KVKey, KVListOptions, KVListResult, KVPutOptions } from "@baseless/core/kv";
import {
	type Document,
	type DocumentGetOptions,
	type DocumentListEntry,
	type DocumentListOptions,
	DocumentNotFoundError,
} from "@baseless/core/document";
import type { AnyDocumentService, NotificationService, ServiceCollection } from "./service.ts";
import { first } from "@baseless/core/iter";
import type { AnyPubSubService } from "./service.ts";
import type { Identity, IdentityChannel } from "@baseless/core/identity";
import { type Notification, NotificationChannelNotFoundError } from "@baseless/core/notification";

export class KVFacade {
	#provider: KVProvider;

	constructor(provider: KVProvider) {
		this.#provider = provider;
	}

	get(
		key: string,
		options?: KVGetOptions,
		signal?: AbortSignal,
	): Promise<KVKey> {
		return this.#provider.get(key, options, signal);
	}

	put(
		key: string,
		value: unknown,
		options?: KVPutOptions,
		signal?: AbortSignal,
	): Promise<void> {
		return this.#provider.put(key, value, options, signal);
	}

	list(options: KVListOptions, signal?: AbortSignal): Promise<KVListResult> {
		return this.#provider.list(options, signal);
	}

	delete(key: string, signal?: AbortSignal): Promise<void> {
		return this.#provider.delete(key, signal);
	}
}

export class DocumentFacade implements AnyDocumentService {
	#auth: Auth;
	#documentProvider: DocumentProvider;
	#service: ServiceCollection;
	#context: RegisteredContext;
	#waitUntil: (promise: PromiseLike<unknown>) => void;
	#collectionMatcher: Matcher<TCollection<any, any, any>>;
	#documentMatcher: Matcher<TDocument<any, any>>;
	#onDocumentSettingMatcher: Matcher<TOnDocumentSetting>;
	#onDocumentDeletingMatcher: Matcher<TOnDocumentDeleting>;

	constructor(
		auth: Auth,
		provider: DocumentProvider,
		service: ServiceCollection,
		context: RegisteredContext,
		waitUntil: (promise: PromiseLike<unknown>) => void,
		collectionMatcher: Matcher<TCollection<any, any, any>>,
		documentMatcher: Matcher<TDocument<any, any>>,
		onDocumentSettingMatcher: Matcher<TOnDocumentSetting>,
		onDocumentDeletingMatcher: Matcher<TOnDocumentDeleting>,
	) {
		this.#auth = auth;
		this.#documentProvider = provider;
		this.#service = service;
		this.#context = context;
		this.#waitUntil = waitUntil;
		this.#collectionMatcher = collectionMatcher;
		this.#documentMatcher = documentMatcher;
		this.#onDocumentSettingMatcher = onDocumentSettingMatcher;
		this.#onDocumentDeletingMatcher = onDocumentDeletingMatcher;
	}

	get(
		key: string,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Document> {
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var _ = first(this.#documentMatcher(key));
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}

		return this.#documentProvider.get(key, options, signal);
	}

	getMany(
		keys: Array<string>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Array<Document>> {
		try {
			for (const key of keys) {
				// deno-lint-ignore no-var no-inner-declarations
				var _ = first(this.#documentMatcher(key));
			}
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}

		return this.#documentProvider.getMany(keys, options, signal);
	}

	list(
		options: DocumentListOptions,
		signal?: AbortSignal,
	): ReadableStream<DocumentListEntry> {
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var _ = first(this.#collectionMatcher(options.prefix));
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}

		return this.#documentProvider.list(options, signal);
	}

	atomic(): DocumentAtomic {
		return new DocumentFacadeAtomic(
			this.#documentProvider,
			this.#service,
			this.#context,
			this.#waitUntil,
			this.#documentMatcher,
			this.#onDocumentSettingMatcher,
			this.#onDocumentDeletingMatcher,
		);
	}
}

export class DocumentFacadeAtomic extends DocumentAtomic {
	#auth: Auth;
	#documentProvider: DocumentProvider;
	#service: ServiceCollection;
	#context: RegisteredContext;
	#waitUntil: (promise: PromiseLike<unknown>) => void;
	#matcher: Matcher<TDocument<any, any>>;
	#onDocumentSettingMatcher: Matcher<TOnDocumentSetting>;
	#onDocumentDeletingMatcher: Matcher<TOnDocumentDeleting>;

	constructor(
		provider: DocumentProvider,
		service: ServiceCollection,
		context: RegisteredContext,
		waitUntil: (promise: PromiseLike<unknown>) => void,
		matcher: Matcher<TDocument<any, any>>,
		onDocumentSetting: Matcher<TOnDocumentSetting>,
		onDocumentDeleting: Matcher<TOnDocumentDeleting>,
	) {
		super();
		this.#documentProvider = provider;
		this.#service = service;
		this.#context = context;
		this.#waitUntil = waitUntil;
		this.#matcher = matcher;
		this.#onDocumentSettingMatcher = onDocumentSetting;
		this.#onDocumentDeletingMatcher = onDocumentDeleting;
	}

	override check(key: string, versionstamp: string | null): DocumentAtomic {
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var _ = first(this.#matcher(key));
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}
		this.checks.push({ type: "check", key, versionstamp });
		return this;
	}

	override set(key: string, data: unknown): DocumentAtomic {
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var [_, definition] = first(this.#matcher(key));
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}
		assert(definition.data, data);
		this.operations.push({ type: "set", key, data });
		return this;
	}

	override delete(key: string): DocumentAtomic {
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var _ = first(this.#matcher(key));
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}
		this.operations.push({ type: "delete", key });
		return this;
	}

	async commit(signal?: AbortSignal): Promise<void> {
		const atomic = this.#documentProvider.atomic();
		for (const check of this.checks) {
			atomic.check(check.key, check.versionstamp);
		}
		for (const op of this.operations) {
			if (op.type === "set") {
				atomic.set(op.key, op.data);
				// Trigger onDocumentSetting hooks
				const document = {
					key: op.key,
					data: op.data,
					versionstamp: "",
				};
				for (
					const [params, definition] of this.#onDocumentSettingMatcher(
						op.key,
					)
				) {
					await definition.handler({
						auth: this.#auth,
						atomic: this,
						context: this.#context,
						document,
						params,
						signal: signal ?? new AbortController().signal,
						service: this.#service,
						waitUntil: this.#waitUntil,
					});
				}
			} else {
				atomic.delete(op.key);
				// Trigger onDocumentDeleting hooks
				for (
					const [params, definition] of this.#onDocumentDeletingMatcher(
						op.key,
					)
				) {
					await definition.handler({
						auth: this.#auth,
						atomic: this,
						context: this.#context,
						params,
						signal: signal ?? new AbortController().signal,
						service: this.#service,
						waitUntil: this.#waitUntil,
					});
				}
			}
		}
		await atomic.commit(signal);

		for (const op of this.operations) {
			if (op.type === "set") {
				this.#waitUntil(this.#service.pubsub.publish(op.key, { type: "set", document: op.data }, signal));
			} else {
				this.#waitUntil(this.#service.pubsub.publish(op.key, { type: "delete" }, signal));
			}
		}
	}
}

export class PubSubFacade implements AnyPubSubService {
	#queueProvider: QueueProvider;
	#topicMatcher: Matcher<TTopic<any, any>>;

	constructor(
		provider: QueueProvider,
		topicMatcher: Matcher<TTopic<any, any>>,
	) {
		this.#queueProvider = provider;
		this.#topicMatcher = topicMatcher;
	}

	async publish(
		key: string,
		payload: unknown,
		signal?: AbortSignal,
	): Promise<void> {
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var [_, definition] = first(this.#topicMatcher(key));
		} catch (cause) {
			throw new TopicNotFoundError(undefined, { cause });
		}
		assert(definition.message, payload);

		await this.#queueProvider.enqueue({ type: "pubsub_message", payload: { key, payload } }, signal);
	}
}

export class NotificationFacade implements NotificationService {
	#notificationChannelProviders: Record<string, NotificationChannelProvider>;
	#service: ServiceCollection;

	constructor(
		notificationChannelProviders: Record<string, NotificationChannelProvider>,
		service: ServiceCollection,
	) {
		this.#notificationChannelProviders = notificationChannelProviders;
		this.#service = service;
	}

	async notify(identityId: Identity["id"], notification: Notification, signal?: AbortSignal): Promise<boolean> {
		let notified = false;
		for await (const entry of this.#service.document.list({ prefix: `auth/identity/${identityId}/channel` })) {
			const identityChannel = entry.document.data as IdentityChannel;
			if (identityChannel.confirmed) {
				const notificationChannelProvider = this.#notificationChannelProviders[identityChannel.channelId];
				notified ||= await notificationChannelProvider?.send(identityChannel, notification, signal) ?? false;
			}
		}
		return notified;
	}

	async notifyChannel(identityId: Identity["id"], channel: string, notification: Notification, signal?: AbortSignal): Promise<boolean> {
		try {
			const identityChannel = await this.#service.document
				.get(`auth/identity/${identityId}/channel/${channel}`, undefined, signal)
				.then((d) => d.data as IdentityChannel);
			if (identityChannel.confirmed) {
				const notificationChannelProvider = this.#notificationChannelProviders[identityChannel.channelId];
				return await notificationChannelProvider?.send(identityChannel, notification, signal) ?? false;
			}
			return false;
		} catch (cause) {
			throw new NotificationChannelNotFoundError(undefined, { cause });
		}
	}

	unsafeNotifyChannel(identityChannel: IdentityChannel, notification: Notification, signal?: AbortSignal): Promise<boolean> {
		if (identityChannel.confirmed) {
			const channel = this.#notificationChannelProviders[identityChannel.channelId];
			return channel?.send(identityChannel, notification, signal) ?? true;
		}
		return Promise.resolve(false);
	}
}

export class RateLimiterFacade {
	#provider: RateLimiterProvider;

	constructor(provider: RateLimiterProvider) {
		this.#provider = provider;
	}

	limit(options: RateLimiterProviderLimitOptions): Promise<boolean> {
		return this.#provider.limit(options);
	}
}
