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
	StorageProvider,
	TableProvider,
} from "./provider.ts";
import type { KVGetOptions, KVKey, KVListOptions, KVListResult, KVPutOptions } from "@baseless/core/kv";
import { type Document, type DocumentGetOptions, type DocumentListEntry } from "@baseless/core/document";
import type {
	DocumentService,
	DocumentServiceAtomic,
	DocumentServiceAtomicCheck,
	DocumentServiceAtomicOperation,
	KVService,
	NotificationService,
	PubSubService,
	ServiceCollection,
	StorageService,
	TableService,
} from "./service.ts";
import { first } from "@baseless/core/iter";
import type { Identity, IdentityChannel } from "@baseless/core/identity";
import { type Notification } from "@baseless/core/notification";
import {
	DocumentNotFoundError,
	NotificationChannelNotFoundError,
	StorageFolderNotFoundError,
	StorageObjectNotFoundError,
	TopicNotFoundError,
} from "@baseless/core/errors";
import { type PathToParams, resolvePath } from "@baseless/core/path";
import type { Session } from "@baseless/core/session";
import type { AuthenticationTokens } from "@baseless/core/authentication-tokens";
import { jwtVerify } from "jose/jwt/verify";
import { assertID, ID, id, isID } from "@baseless/core/id";
import { SignJWT } from "jose/jwt/sign";
import type { TStatement } from "@baseless/core/query";
import type {
	StorageListEntry,
	StorageObject,
	StoragePutOptions,
	StorageSignedDownloadUrlOptions,
	StorageSignedUploadUrlOptions,
	StorageSignedUrl,
} from "@baseless/core/storage";
import tracer, { traced } from "./tracer.ts";

/**
 * Facade that wraps a {@link KVProvider} and implements the {@link KVService}
 * interface consumed by handlers.
 */
export class KVFacade implements KVService {
	#provider: KVProvider;

	constructor(provider: KVProvider) {
		this.#provider = provider;
	}

	get(
		key: string,
		options?: KVGetOptions,
	): Promise<KVKey> {
		return traced("@baseless/server.facade.kv.get", {
			"kv.key": key,
			"kv.cacheTtl": options?.cacheTtl ?? "",
		}, (_span) => this.#provider.get(key, options));
	}

	put(
		key: string,
		value: unknown,
		options?: KVPutOptions,
	): Promise<void> {
		return traced("@baseless/server.facade.kv.put", {
			"kv.key": key,
			"kv.expiration": options?.expiration
				? (typeof options.expiration === "number" ? options.expiration : options.expiration.getTime())
				: "",
		}, (_span) => this.#provider.put(key, value, options));
	}

	list(options: KVListOptions): Promise<KVListResult> {
		return traced("@baseless/server.facade.kv.list", {
			"kv.cursor": options.cursor ?? "",
			"kv.prefix": options.prefix,
			"kv.limit": options.limit ?? "",
		}, (_span) => this.#provider.list(options));
	}

	delete(key: string, options?: { signal?: AbortSignal }): Promise<void> {
		return traced("@baseless/server.facade.kv.delete", {
			"kv.key": key,
		}, (_span) => this.#provider.delete(key, options));
	}
}

/** Options required to construct a {@link AuthFacade}. */
export interface AuthFacadeOptions {
	configuration: AppRegistry["configuration"]["auth"];
	document: DocumentProvider;
	kv: KVProvider;
}

export class AuthFacade {
	#options: AuthFacadeOptions;

	constructor(options: AuthFacadeOptions) {
		this.#options = options;
	}

	authenticate(authorization: string, _options?: { signal?: AbortSignal }): Promise<Auth> {
		return traced("@baseless/server.facade.auth.authenticate", undefined, async (_span) => {
			if (this.#options.configuration?.keyPublic === undefined) {
				return undefined;
			} else if (authorization.startsWith("Bearer ")) {
				try {
					const config = this.#options.configuration!;
					const { payload } = await jwtVerify(
						authorization.slice("Bearer ".length),
						config.keyPublic,
						"keyAlgo" in config ? { algorithms: [config.keyAlgo] } : undefined,
					);
					if (isID("id_", payload.sub)) {
						return {
							identityId: payload.sub!,
							scope: `${payload.scope}`.split(" "),
						};
					}
					// deno-lint-ignore no-empty
				} catch (_error) {}
			} else if (authorization.startsWith("Token ")) {
				// "Token" scheme not implemented; treat as unauthenticated.
				return undefined;
			}
			return undefined;
		});
	}

	revoke(authorization: string, options?: { signal?: AbortSignal }): Promise<void> {
		return traced("@baseless/server.facade.auth.revoke", undefined, async (_span) => {
			if (this.#options.configuration?.keyPublic === undefined) {
				return undefined;
			} else if (authorization.startsWith("Bearer ")) {
				const config = this.#options.configuration!;
				const { payload } = await jwtVerify(
					authorization.slice("Bearer ".length),
					config.keyPublic,
					"keyAlgo" in config ? { algorithms: [config.keyAlgo] } : undefined,
				);
				const { sub, sid } = payload;
				if (isID("id_", sub) && isID("ses_", sid)) {
					await this.#options.kv.delete(`auth/identity/${sub}/session/${sid}`, options);
				}
			} else if (authorization.startsWith("Token ")) {
				// "Token" scheme not implemented; treat as unauthenticated.
				return;
			}
		});
	}

	#createTokens(
		identity: Identity,
		issuedAt: number,
		sessionId: ID<"ses_">,
		scope: string[],
	): Promise<AuthenticationTokens> {
		return traced("@baseless/server.facade.auth.createTokens", {
			"auth.identityId": identity.id.toString(),
			"auth.issuedAt": issuedAt,
			"auth.sessionId": sessionId.toString(),
			"auth.scope": scope,
		}, async (_span) => {
			if (
				this.#options.configuration?.keyPublic === undefined ||
				this.#options.configuration === undefined ||
				!("keyPrivate" in this.#options.configuration)
			) {
				throw new Error("Authentication is not properly configured");
			}
			const now = Date.now();
			const accessToken = await new SignJWT({ scope, aat: issuedAt, sid: sessionId })
				.setSubject(identity.id.toString())
				.setIssuedAt()
				.setExpirationTime((now + this.#options.configuration.accessTokenTTL) / 1000 >> 0)
				.setProtectedHeader({ alg: this.#options.configuration.keyAlgo })
				.sign(this.#options.configuration.keyPrivate);
			const idToken = await new SignJWT({ claims: Object.fromEntries(scope.map((s) => [s, identity.data?.[s]])) })
				.setSubject(identity.id.toString())
				.setIssuedAt()
				.setExpirationTime((now + this.#options.configuration.accessTokenTTL) / 1000 >> 0)
				.setProtectedHeader({ alg: this.#options.configuration.keyAlgo })
				.sign(this.#options.configuration.keyPrivate);
			const refreshToken = typeof this.#options.configuration.refreshTokenTTL === "number"
				? await new SignJWT({ scope, sid: sessionId })
					.setSubject(identity.id.toString())
					.setIssuedAt(issuedAt)
					.setExpirationTime((now + this.#options.configuration.refreshTokenTTL) / 1000 >> 0)
					.setProtectedHeader({ alg: this.#options.configuration.keyAlgo })
					.sign(this.#options.configuration.keyPrivate)
				: undefined;
			return { accessToken, idToken, refreshToken };
		});
	}

	createSession(
		identity: Identity,
		issuedAt: number,
		scope: string[],
		options?: { signal?: AbortSignal },
	): Promise<AuthenticationTokens> {
		return traced("@baseless/server.facade.auth.createSession", {
			"auth.identityId": identity.id.toString(),
			"auth.issuedAt": issuedAt,
			"auth.scope": JSON.stringify(scope),
			"auth.options": JSON.stringify(options),
		}, async (_span) => {
			if (
				this.#options.configuration?.keyPublic === undefined ||
				this.#options.configuration === undefined ||
				!("keyPrivate" in this.#options.configuration)
			) {
				throw new Error("Authentication is not properly configured");
			}
			const session: Session = {
				id: id("ses_"),
				identityId: identity.id,
				issuedAt,
				scope,
			};
			const tokens = await this.#createTokens(identity, issuedAt, session.id, scope);
			await this.#options.kv.put(`auth/identity/${identity.id}/session/${session.id}`, session, {
				expiration: this.#options.configuration.refreshTokenTTL ?? this.#options.configuration.accessTokenTTL,
			});
			return tokens;
		});
	}

	refreshSession(refreshToken: string, options?: { signal?: AbortSignal }): Promise<AuthenticationTokens> {
		return traced("@baseless/server.facade.auth.refreshSession", undefined, async (_span) => {
			if (
				this.#options.configuration?.keyPublic === undefined ||
				this.#options.configuration === undefined ||
				!("keyPrivate" in this.#options.configuration)
			) {
				throw new Error("Authentication is not properly configured");
			}
			const { payload } = await jwtVerify(refreshToken, this.#options.configuration.keyPublic, {
				algorithms: [this.#options.configuration.keyAlgo],
			});
			const { sub, sid } = payload;
			assertID("id_", sub);
			assertID("ses_", sid);
			const session = await this.#options.kv.get(`auth/identity/${sub}/session/${sid}`, { signal: options?.signal })
				.then((v) => v.value as Session);
			const identity = await this.#options.document.get(resolvePath("auth/identity/:key", { key: sub }), { signal: options?.signal })
				.then((d) => d as Document<Identity>);
			const tokens = await this.#createTokens(
				identity.data,
				session.issuedAt,
				sid,
				session.scope,
			);
			return tokens;
		});
	}
}

/** Options required to construct a {@link DocumentFacade}. */
export interface DocumentFacadeOptions {
	app: App;
	auth: Auth;
	configuration: AppRegistry["configuration"];
	context: AppRegistry["context"];
	provider: DocumentProvider;
	service: ServiceCollection;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}

/**
 * Facade that wraps a {@link DocumentProvider} with authorization checks
 * and implements the {@link DocumentService} interface.
 */
export class DocumentFacade implements DocumentService<any, any> {
	#options: DocumentFacadeOptions;

	constructor(options: DocumentFacadeOptions) {
		this.#options = options;
	}

	get<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: DocumentGetOptions,
	): Promise<Document<any>> {
		return traced("@baseless/server.facade.document.get", {
			"document.path": path,
			"document.params": JSON.stringify(params),
			"document.options": JSON.stringify(options),
		}, (_span) => {
			const key = resolvePath(path, params);
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var _ = first(this.#options.app.match("document", key));
			} catch (cause) {
				throw new DocumentNotFoundError(undefined, { cause });
			}

			return this.#options.provider.get(key, options);
		});
	}

	getMany<TPath extends keyof any & string>(
		keys: Array<[path: TPath, params: PathToParams<TPath>]>,
		options?: DocumentGetOptions,
	): Promise<Array<Document<any>>> {
		return traced("@baseless/server.facade.document.getMany", {
			"document.keys": JSON.stringify(keys),
			"document.options": JSON.stringify(options),
		}, (_span) => {
			const resolvedKeys = keys.map(([path, params]) => resolvePath(path, params));
			try {
				for (const key of resolvedKeys) {
					// deno-lint-ignore no-var no-inner-declarations
					var _ = first(this.#options.app.match("document", key));
				}
			} catch (cause) {
				throw new DocumentNotFoundError(undefined, { cause });
			}

			return this.#options.provider.getMany(resolvedKeys, options);
		});
	}

	list<TPath extends keyof any & string>(
		prefix: TPath,
		params: PathToParams<TPath>,
		options?: { cursor?: string; limit?: number; signal?: AbortSignal },
	): ReadableStream<DocumentListEntry<any>> {
		const span = tracer.startSpan("@baseless/server.facade.document.list");
		span.setAttribute("document.prefix", prefix);
		span.setAttribute("document.params", JSON.stringify(params));
		span.setAttribute("document.options", JSON.stringify(options));
		try {
			const key = resolvePath(prefix, params);
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var _ = first(this.#options.app.match("collection", key));
			} catch (cause) {
				throw new DocumentNotFoundError(undefined, { cause });
			}

			return this.#options.provider.list({
				prefix: key,
				cursor: options?.cursor,
				limit: options?.limit,
				signal: options?.signal,
			});
		} catch (cause) {
			span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
			span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
			throw cause;
		} finally {
			span.end();
		}
	}

	atomic(): DocumentServiceAtomic<any> {
		return new DocumentFacadeAtomic(this.#options);
	}
}

/**
 * Atomic operation builder that wraps a {@link DocumentProvider}\'s atomic
 * and enforces authorization checks and triggers document lifecycle hooks.
 */
export class DocumentFacadeAtomic implements DocumentServiceAtomic<any> {
	#options: DocumentFacadeOptions;
	checks: DocumentServiceAtomicCheck[] = [];
	operations: DocumentServiceAtomicOperation[] = [];

	constructor(options: DocumentFacadeOptions) {
		this.#options = options;
	}

	check<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		versionstamp: string | null,
	): DocumentServiceAtomic<any> {
		const span = tracer.startSpan("@baseless/server.facade.document.atomic.check");
		span.setAttribute("document.path", path);
		span.setAttribute("document.params", JSON.stringify(params));
		try {
			const key = resolvePath(path, params);
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var _ = first(this.#options.app.match("document", key));
			} catch (cause) {
				throw new DocumentNotFoundError(undefined, { cause });
			}
			this.checks.push({ type: "check", key, versionstamp });
			return this;
		} catch (cause) {
			span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
			span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
			throw cause;
		} finally {
			span.end();
		}
	}

	set<TPath extends keyof any & string>(path: TPath, params: PathToParams<TPath>, value: any): DocumentServiceAtomic<any> {
		const span = tracer.startSpan("@baseless/server.facade.document.atomic.set");
		span.setAttribute("document.path", path);
		span.setAttribute("document.params", JSON.stringify(params));
		try {
			const key = resolvePath(path, params);
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [_, definition] = first(this.#options.app.match("document", key));
			} catch (cause) {
				throw new DocumentNotFoundError(undefined, { cause });
			}
			assert(definition.schema, value);
			this.operations.push({ type: "set", key, data: value });
			return this;
		} catch (cause) {
			span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
			span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
			throw cause;
		} finally {
			span.end();
		}
	}

	delete<TPath extends keyof any & string>(path: TPath, params: PathToParams<TPath>): DocumentServiceAtomic<any> {
		const span = tracer.startSpan("@baseless/server.facade.document.atomic.delete");
		span.setAttribute("document.path", path);
		span.setAttribute("document.params", JSON.stringify(params));
		try {
			const key = resolvePath(path, params);
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var _ = first(this.#options.app.match("document", key));
			} catch (cause) {
				throw new DocumentNotFoundError(undefined, { cause });
			}
			this.operations.push({ type: "delete", key });
			return this;
		} catch (cause) {
			span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
			span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
			throw cause;
		} finally {
			span.end();
		}
	}

	commit(options?: { signal?: AbortSignal }): Promise<void> {
		return traced("@baseless/server.facade.document.atomic.commit", {
			"atomic.checks": JSON.stringify(this.checks),
			"atomic.operations": JSON.stringify(this.operations),
			"atomic.options": JSON.stringify(options),
		}, async (_span) => {
			const signal = options?.signal;
			const atomic = this.#options.provider.atomic();
			const messages = [] as Array<{ key: string; payload: never }>;
			for (const check of this.checks) {
				atomic.check(check.key, check.versionstamp);
			}
			for (const op of this.operations) {
				if (op.type === "set") {
					atomic.set(op.key, op.data);
					const document = { key: op.key, data: op.data, versionstamp: "" };
					messages.push({ key: op.key, payload: { type: "set", document } as never });
					try {
						const collectionKey = op.key.split("/").slice(0, -1).join("/");
						const [_, _definition] = first(this.#options.app.match("collection", collectionKey));
						messages.push({
							key: collectionKey,
							payload: { type: "set", document } as never,
						});
					} catch (_cause) {
						// No collection definition for this key; skip collection-level message.
					}
					for (
						const [params, definition] of this.#options.app.match("onDocumentSetting", op.key)
					) {
						await traced("@baseless/server.facade.document.atomic.onDocumentSetting", {
							"onDocumentSetting.path": definition.path,
							"onDocumentSetting.params": JSON.stringify(params),
						}, async (_span) => {
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
						});
					}
				} else {
					atomic.delete(op.key);
					messages.push({ key: op.key, payload: { type: "deleted" } as never });
					for (
						const [params, definition] of this.#options.app.match("onDocumentDeleting", op.key)
					) {
						await traced("@baseless/server.facade.document.atomic.onDocumentSetting", {
							"onDocumentSetting.path": definition.path,
							"onDocumentSetting.params": JSON.stringify(params),
						}, async (_span) => {
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
						});
					}
				}
			}
			await atomic.commit(options);

			for (const { key, payload } of messages) {
				this.#options.waitUntil(this.#options.service.pubsub.publish(key as never, {} as never, payload, { signal }));
			}
		});
	}
}

/** Options required to construct a {@link PubSubFacade}. */
export interface PubSubFacadeOptions {
	app: App;
	provider: QueueProvider;
}

/**
 * Facade that implements {@link PubSubService} by enqueuing topic-publish
 * jobs via the {@link QueueProvider}.
 */
export class PubSubFacade implements PubSubService<any> {
	#options: PubSubFacadeOptions;

	constructor(options: PubSubFacadeOptions) {
		this.#options = options;
	}

	publish<TTopic extends keyof any & string>(
		path: TTopic,
		params: PathToParams<TTopic>,
		payload: any,
		options?: { signal?: AbortSignal },
	): Promise<void> {
		return traced("@baseless/server.facade.pubsub.publish", {
			"pubsub.path": path,
			"pubsub.params": JSON.stringify(params),
			"pubsub.payload": JSON.stringify(payload),
		}, async (_span) => {
			const key = resolvePath(path, params);
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [_, definition] = first(this.#options.app.match("topic", key));
			} catch (cause) {
				throw new TopicNotFoundError(undefined, { cause });
			}
			assert(definition.schema, payload);

			await this.#options.provider.enqueue(
				{ type: "topic_publish", key, payload },
				options,
			);
		});
	}
}

/** Options required to construct a {@link NotificationFacade}. */
export interface NotificationFacadeOptions {
	providers: Record<string, NotificationChannelProvider>;
	service: ServiceCollection;
}

/**
 * Facade that implements {@link NotificationService} by routing notifications
 * to the appropriate {@link NotificationChannelProvider}.
 */
export class NotificationFacade implements NotificationService {
	#options: NotificationFacadeOptions;

	constructor(options: NotificationFacadeOptions) {
		this.#options = options;
	}

	notify(identityId: Identity["id"], notification: Notification, options?: { signal?: AbortSignal }): Promise<boolean> {
		return traced("@baseless/server.facade.notification.notify", {
			"notification.identityId": identityId.toString(),
			"notification.notification": JSON.stringify(notification),
			"notification.options": JSON.stringify(options),
		}, async (_span) => {
			let notified = false;
			for await (
				const entry of this.#options.service.document.list(`auth/identity/:identityId/channel` as never, { identityId } as never)
			) {
				const identityChannel = entry.document.data as IdentityChannel;
				if (identityChannel.confirmed) {
					const notificationChannelProvider = this.#options.providers[identityChannel.channelId];
					notified ||= await notificationChannelProvider?.send(identityChannel, notification, options) ?? false;
				}
			}
			return notified;
		});
	}

	notifyChannel(
		identityId: Identity["id"],
		channel: string,
		notification: Notification,
		options?: { signal?: AbortSignal },
	): Promise<boolean> {
		return tracer.startActiveSpan("@baseless/server.facade.notification.notifyChannel", async (span) => {
			span.setAttribute("notification.identityId", identityId.toString());
			span.setAttribute("notification.channel", channel);
			span.setAttribute("notification.notification", JSON.stringify(notification));
			try {
				const identityChannel = await this.#options.service.document
					.get(`auth/identity/:identityId/channel/:channel` as never, { identityId, channel } as never, { signal: options?.signal })
					.then((d) => d.data as IdentityChannel);
				if (identityChannel.confirmed) {
					const notificationChannelProvider = this.#options.providers[identityChannel.channelId];
					return await notificationChannelProvider?.send(identityChannel, notification, options) ?? false;
				}
				return false;
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: "Failed to notify channel" });
				throw new NotificationChannelNotFoundError(undefined, { cause });
			} finally {
				span.end();
			}
		});
	}

	unsafeNotifyChannel(identityChannel: IdentityChannel, notification: Notification, options?: { signal?: AbortSignal }): Promise<boolean> {
		return tracer.startActiveSpan("@baseless/server.facade.notification.unsafeNotifyChannel", (span) => {
			span.setAttribute("notification.identityChannel", JSON.stringify(identityChannel));
			span.setAttribute("notification.notification", JSON.stringify(notification));
			span.setAttribute("notification.options", JSON.stringify(options));
			try {
				if (identityChannel.confirmed) {
					const channel = this.#options.providers[identityChannel.channelId];
					return channel?.send(identityChannel, notification, options) ?? true;
				}
				return Promise.resolve(false);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: "Failed to notify channel" });
				throw cause;
			} finally {
				span.end();
			}
		});
	}
}

/**
 * Facade that wraps a {@link RateLimiterProvider} and exposes the
 * {@link RateLimiterService} interface.
 */
export class RateLimiterFacade {
	#provider: RateLimiterProvider;

	constructor(provider: RateLimiterProvider) {
		this.#provider = provider;
	}

	limit(options: RateLimiterProviderLimitOptions): Promise<boolean> {
		return traced("@baseless/server.facade.ratelimiter.limit", {
			"ratelimiter.key": options.key,
			"ratelimiter.limit": options.limit,
			"ratelimiter.period": options.period,
		}, (_span) => this.#provider.limit(options));
	}
}

/**
 * Facade that wraps a {@link TableProvider} and implements the
 * {@link TableService} interface consumed by server-internal handlers.
 *
 * Security (table-level and row-level) is enforced at the client-facing
 * app layer (`server/apps/table.ts`), not here.
 */
export class TableFacade implements TableService<any> {
	#provider: TableProvider;

	constructor(provider: TableProvider) {
		this.#provider = provider;
	}

	execute<TParams extends Record<string, unknown>, TOutput>(
		statement: TStatement<TParams, TOutput>,
		params: TParams,
		options?: { signal?: AbortSignal },
	): Promise<TOutput> {
		return traced("@baseless/server.facade.table.execute", {
			"table.statement": JSON.stringify(statement),
			"table.params": JSON.stringify(params),
		}, (_span) => this.#provider.execute(statement as TStatement<Record<string, unknown>, unknown>, params, options) as Promise<TOutput>);
	}
}

/** Options required to construct a {@link StorageFacade}. */
export interface StorageFacadeOptions {
	app: App;
	storageProvider: StorageProvider;
	queueProvider: QueueProvider;
	waitUntil: (promise: PromiseLike<unknown>) => void;
}

/**
 * Facade that wraps a {@link StorageProvider} with path-validation checks
 * and implements the {@link StorageService} interface.
 */
export class StorageFacade implements StorageService<any, any> {
	#options: StorageFacadeOptions;

	constructor(options: StorageFacadeOptions) {
		this.#options = options;
	}

	getMetadata<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: { signal?: AbortSignal },
	): Promise<StorageObject> {
		return traced("@baseless/server.facade.storage.getMetadata", {
			"storage.path": path,
			"storage.params": JSON.stringify(params),
			"storage.options": JSON.stringify(options),
		}, (_span) => {
			const key = resolvePath(path, params);
			try {
				const _ = first(this.#options.app.match("file", key));
			} catch (cause) {
				throw new StorageObjectNotFoundError(undefined, { cause });
			}
			return this.#options.storageProvider.getMetadata(key, options);
		});
	}

	getSignedUploadUrl<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: StorageSignedUploadUrlOptions,
	): Promise<StorageSignedUrl> {
		return traced("@baseless/server.facade.storage.getSignedUploadUrl", {
			"storage.path": path,
			"storage.params": JSON.stringify(params),
			"storage.options": JSON.stringify(options),
		}, (_span) => {
			const key = resolvePath(path, params);
			try {
				const _ = first(this.#options.app.match("file", key));
			} catch (cause) {
				throw new StorageObjectNotFoundError(undefined, { cause });
			}
			return this.#options.storageProvider.getSignedUploadUrl(key, options);
		});
	}

	getSignedDownloadUrl<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: StorageSignedDownloadUrlOptions,
	): Promise<StorageSignedUrl> {
		return traced("@baseless/server.facade.storage.getSignedDownloadUrl", {
			"storage.path": path,
			"storage.params": JSON.stringify(params),
			"storage.options": JSON.stringify(options),
		}, (_span) => {
			const key = resolvePath(path, params);
			try {
				const _ = first(this.#options.app.match("file", key));
			} catch (cause) {
				throw new StorageObjectNotFoundError(undefined, { cause });
			}
			return this.#options.storageProvider.getSignedDownloadUrl(key, options);
		});
	}

	put<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		content: ReadableStream<Uint8Array> | ArrayBuffer | Blob,
		options?: StoragePutOptions,
	): Promise<void> {
		return traced("@baseless/server.facade.storage.put", {
			"storage.path": path,
			"storage.params": JSON.stringify(params),
			"storage.options": JSON.stringify(options),
		}, async (_span) => {
			const key = resolvePath(path, params);
			try {
				const _ = first(this.#options.app.match("file", key));
			} catch (cause) {
				throw new StorageObjectNotFoundError(undefined, { cause });
			}
			await this.#options.storageProvider.put(key, content, options);
			const file = await this.#options.storageProvider.getMetadata(key);
			this.#options.waitUntil(this.#options.queueProvider.enqueue({ type: "file_uploaded", key: key as never, file }));
		});
	}

	get<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: { signal?: AbortSignal },
	): Promise<ReadableStream<Uint8Array>> {
		return traced("@baseless/server.facade.storage.get", {
			"storage.path": path,
			"storage.params": JSON.stringify(params),
		}, (_span) => {
			const key = resolvePath(path, params);
			try {
				const _ = first(this.#options.app.match("file", key));
			} catch (cause) {
				throw new StorageObjectNotFoundError(undefined, { cause });
			}
			return this.#options.storageProvider.get(key, options);
		});
	}

	delete<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: { signal?: AbortSignal },
	): Promise<void> {
		return traced("@baseless/server.facade.storage.delete", {
			"storage.path": path,
			"storage.params": JSON.stringify(params),
		}, async (_span) => {
			const key = resolvePath(path, params);
			try {
				const _ = first(this.#options.app.match("file", key));
				// deno-lint-ignore no-var no-inner-declarations
				var file = await this.#options.storageProvider.getMetadata(key, options);
			} catch (cause) {
				throw new StorageObjectNotFoundError(undefined, { cause });
			}

			await this.#options.storageProvider.delete(key, options);

			this.#options.waitUntil(this.#options.queueProvider.enqueue({ type: "file_deleted", key: key as never, file }));
		});
	}

	list<TPath extends keyof any & string>(
		prefix: TPath,
		params: PathToParams<TPath>,
		options?: { cursor?: string; limit?: number; signal?: AbortSignal },
	): ReadableStream<StorageListEntry> {
		const span = tracer.startSpan("@baseless/server.facade.storage.list");
		span.setAttribute("storage.prefix", prefix);
		span.setAttribute("storage.params", JSON.stringify(params));
		span.setAttribute("storage.options", JSON.stringify(options));
		try {
			const key = resolvePath(prefix, params);
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var _ = first(this.#options.app.match("folder", key));
			} catch (cause) {
				throw new StorageFolderNotFoundError(undefined, { cause });
			}
			return this.#options.storageProvider.list(
				{ prefix: key, cursor: options?.cursor, limit: options?.limit, signal: options?.signal },
			);
		} catch (cause) {
			span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
			span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
			throw cause;
		} finally {
			span.end();
		}
	}
}
