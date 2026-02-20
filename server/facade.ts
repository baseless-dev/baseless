// deno-lint-ignore-file no-explicit-any
import type { App, AppRegistry, Auth } from "./app.ts";
import { assert } from "@baseless/core/schema";
import {
	DocumentProvider,
	KVProvider,
	NotificationChannelProvider,
	QueueProvider,
	RateLimiterProvider,
	RateLimiterProviderLimitOptions,
} from "./provider.ts";
import type { KVGetOptions, KVKey, KVListOptions, KVListResult, KVPutOptions } from "@baseless/core/kv";
import { type Document, type DocumentGetOptions, type DocumentListEntry } from "@baseless/core/document";
import type {
	DocumentService,
	DocumentServiceAtomic,
	DocumentServiceAtomicCheck,
	DocumentServiceAtomicOperation,
	DocumentServiceListOptions,
	KVService,
	NotificationService,
	PubSubService,
	ServiceCollection,
} from "./service.ts";
import { first } from "@baseless/core/iter";
import type { Identity, IdentityChannel } from "@baseless/core/identity";
import { type Notification } from "@baseless/core/notification";
import { DocumentNotFoundError, NotificationChannelNotFoundError, TopicNotFoundError } from "@baseless/core/errors";
import { ref, Reference } from "@baseless/core/ref";

export class KVFacade implements KVService {
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

export interface DocumentFacadeOptions {
	app: App;
	auth: Auth;
	configuration: AppRegistry["configuration"];
	context: AppRegistry["context"];
	provider: DocumentProvider;
	service: ServiceCollection;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}

export class DocumentFacade implements DocumentService<any, any> {
	#options: DocumentFacadeOptions;

	constructor(options: DocumentFacadeOptions) {
		this.#options = options;
	}

	get<TPath extends keyof any>(
		ref: Reference<TPath>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Document<any>> {
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var _ = first(this.#options.app.match("document", ref));
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}

		return this.#options.provider.get(ref, options, signal);
	}

	getMany<TPath extends keyof any>(
		refs: Array<Reference<TPath>>,
		options?: DocumentGetOptions,
		signal?: AbortSignal,
	): Promise<Array<Document<any>>> {
		try {
			for (const ref of refs) {
				// deno-lint-ignore no-var no-inner-declarations
				var _ = first(this.#options.app.match("document", ref));
			}
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}

		return this.#options.provider.getMany(refs, options, signal);
	}

	list<TPath extends keyof any>(
		options: DocumentServiceListOptions<TPath>,
		signal?: AbortSignal,
	): ReadableStream<DocumentListEntry<any>> {
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var _ = first(this.#options.app.match("collection", options.prefix));
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}

		return this.#options.provider.list({
			prefix: options.prefix,
			cursor: options.cursor,
			limit: options.limit,
		}, signal);
	}

	atomic(): DocumentServiceAtomic<any> {
		return new DocumentFacadeAtomic(this.#options);
	}
}

export class DocumentFacadeAtomic implements DocumentServiceAtomic<any> {
	#options: DocumentFacadeOptions;
	checks: DocumentServiceAtomicCheck[] = [];
	operations: DocumentServiceAtomicOperation[] = [];

	constructor(options: DocumentFacadeOptions) {
		this.#options = options;
	}

	check<TPath extends keyof any>(ref: Reference<TPath>, versionstamp: string | null): DocumentServiceAtomic<any> {
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var _ = first(this.#options.app.match("document", ref));
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}
		this.checks.push({ type: "check", ref: ref as any, versionstamp });
		return this;
	}

	set<TPath extends keyof any>(ref: Reference<TPath>, value: any): DocumentServiceAtomic<any> {
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var [_, definition] = first(this.#options.app.match("document", ref));
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}
		assert(definition.schema, value);
		this.operations.push({ type: "set", ref: ref as any, data: value });
		return this;
	}

	delete<TPath extends keyof any>(ref: Reference<TPath>): DocumentServiceAtomic<any> {
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var _ = first(this.#options.app.match("document", ref));
		} catch (cause) {
			throw new DocumentNotFoundError(undefined, { cause });
		}
		this.operations.push({ type: "delete", ref: ref as any });
		return this;
	}

	async commit(signal?: AbortSignal): Promise<void> {
		const atomic = this.#options.provider.atomic();
		const messages = [] as Array<{ key: Reference<never>; payload: never }>;
		for (const check of this.checks) {
			atomic.check(check.ref, check.versionstamp);
		}
		for (const op of this.operations) {
			if (op.type === "set") {
				atomic.set(op.ref, op.data);
				const document = { key: op.ref, data: op.data, versionstamp: "" };
				messages.push({ key: op.ref as never, payload: { type: "set", document } as never });
				try {
					const collectionRef = op.ref.split("/").slice(0, -1).join("/");
					const [_, definition] = first(this.#options.app.match("collection", collectionRef));
					messages.push({
						key: collectionRef as never,
						payload: { type: "set", document } as never,
					});
				} catch (_cause) {}
				for (
					const [params, definition] of this.#options.app.match("onDocumentSetting", op.ref)
				) {
					await definition.handler({
						app: this.#options.app,
						atomic: this,
						auth: this.#options.auth,
						configuration: this.#options.configuration,
						context: this.#options.context,
						document: document as never,
						params: params as never,
						signal: signal ?? new AbortController().signal,
						service: this.#options.service,
						waitUntil: this.#options.waitUntil,
					});
				}
			} else {
				atomic.delete(op.ref);
				messages.push({ key: op.ref as never, payload: { type: "deleted" } as never });
				for (
					const [params, definition] of this.#options.app.match("onDocumentDeleting", op.ref)
				) {
					await definition.handler({
						app: this.#options.app,
						atomic: this,
						auth: this.#options.auth,
						configuration: this.#options.configuration,
						context: this.#options.context,
						params: params as never,
						signal: signal ?? new AbortController().signal,
						service: this.#options.service,
						waitUntil: this.#options.waitUntil,
					});
				}
			}
		}
		await atomic.commit(signal);

		for (const { key, payload } of messages) {
			this.#options.waitUntil(this.#options.service.pubsub.publish(key, payload, signal));
		}
	}
}

export interface PubSubFacadeOptions {
	app: App;
	provider: QueueProvider;
}

export class PubSubFacade implements PubSubService<any> {
	#options: PubSubFacadeOptions;

	constructor(options: PubSubFacadeOptions) {
		this.#options = options;
	}

	async publish<TTopic extends keyof any>(
		ref: Reference<TTopic>,
		payload: any,
		signal?: AbortSignal,
	): Promise<void> {
		const key = ref;
		try {
			// deno-lint-ignore no-var no-inner-declarations
			var [_, definition] = first(this.#options.app.match("topic", key));
		} catch (cause) {
			throw new TopicNotFoundError(undefined, { cause });
		}
		assert(definition.schema, payload);

		await this.#options.provider.enqueue(
			{ type: "topic_publish", payload: { key: ref, payload } },
			signal,
		);
	}
}

export interface NotificationFacadeOptions {
	providers: Record<string, NotificationChannelProvider>;
	service: ServiceCollection;
}

export class NotificationFacade implements NotificationService {
	#options: NotificationFacadeOptions;

	constructor(options: NotificationFacadeOptions) {
		this.#options = options;
	}

	async notify(identityId: Identity["id"], notification: Notification, signal?: AbortSignal): Promise<boolean> {
		let notified = false;
		for await (
			const entry of this.#options.service.document.list({ prefix: ref(`auth/identity/:identityId/channel`, { identityId }) as any })
		) {
			const identityChannel = entry.document.data as IdentityChannel;
			if (identityChannel.confirmed) {
				const notificationChannelProvider = this.#options.providers[identityChannel.channelId];
				notified ||= await notificationChannelProvider?.send(identityChannel, notification, signal) ?? false;
			}
		}
		return notified;
	}

	async notifyChannel(identityId: Identity["id"], channel: string, notification: Notification, signal?: AbortSignal): Promise<boolean> {
		try {
			const identityChannel = await this.#options.service.document
				.get(ref(`auth/identity/:identityId/channel/:channel`, { identityId, channel }) as any, undefined, signal)
				.then((d) => d.data as IdentityChannel);
			if (identityChannel.confirmed) {
				const notificationChannelProvider = this.#options.providers[identityChannel.channelId];
				return await notificationChannelProvider?.send(identityChannel, notification, signal) ?? false;
			}
			return false;
		} catch (cause) {
			throw new NotificationChannelNotFoundError(undefined, { cause });
		}
	}

	unsafeNotifyChannel(identityChannel: IdentityChannel, notification: Notification, signal?: AbortSignal): Promise<boolean> {
		if (identityChannel.confirmed) {
			const channel = this.#options.providers[identityChannel.channelId];
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
