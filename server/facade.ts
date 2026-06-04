// deno-lint-ignore-file no-explicit-any
import type { App, AppRegistry, Auth } from "./app.ts";
import { Permission } from "./app.ts";
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
	ForbiddenError,
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
import tracer from "./tracer.ts";

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
		return tracer.startActiveSpan("@baseless/server.facade.kv.get", async (span) => {
			span.setAttribute("kv.key", key);
			span.setAttribute("kv.cacheTtl", options?.cacheTtl ?? "");
			try {
				return this.#provider.get(key, options);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	put(
		key: string,
		value: unknown,
		options?: KVPutOptions,
	): Promise<void> {
		return tracer.startActiveSpan("@baseless/server.facade.kv.put", async (span) => {
			span.setAttribute("kv.key", key);
			span.setAttribute(
				"kv.expiration",
				options?.expiration ? (typeof options.expiration === "number" ? options.expiration : options.expiration.getTime()) : "",
			);
			try {
				return this.#provider.put(key, value, options);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	list(options: KVListOptions): Promise<KVListResult> {
		return tracer.startActiveSpan("@baseless/server.facade.kv.list", async (span) => {
			span.setAttribute("kv.cursor", options.cursor ?? "");
			span.setAttribute("kv.prefix", options.prefix);
			span.setAttribute("kv.limit", options.limit ?? "");
			try {
				return this.#provider.list(options);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	delete(key: string, options?: { signal?: AbortSignal }): Promise<void> {
		return tracer.startActiveSpan("@baseless/server.facade.kv.delete", async (span) => {
			span.setAttribute("kv.key", key);
			try {
				return this.#provider.delete(key, options);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
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

	async authenticate(authorization: string, options?: { signal?: AbortSignal }): Promise<Auth> {
		return tracer.startActiveSpan("@baseless/server.facade.auth.authenticate", async (span) => {
			try {
				if (this.#options.configuration?.keyPublic === undefined) {
					return undefined;
				} else if (authorization.startsWith("Bearer ")) {
					try {
						const { payload } = await jwtVerify(authorization.slice("Bearer ".length), this.#options.configuration?.keyPublic);
						if (isID("id_", payload.sub)) {
							return {
								identityId: payload.sub!,
								scope: `${payload.scope}`.split(" "),
							};
						}
						// deno-lint-ignore no-empty
					} catch (_error) {}
				} else if (authorization.startsWith("Token ")) {
					throw "TODO!";
				}
				return undefined;
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	async revoke(authorization: string, options?: { signal?: AbortSignal }): Promise<void> {
		return tracer.startActiveSpan("@baseless/server.facade.auth.revoke", async (span) => {
			try {
				if (this.#options.configuration?.keyPublic === undefined) {
					return undefined;
				} else if (authorization.startsWith("Bearer ")) {
					const { payload } = await jwtVerify(authorization.slice("Bearer ".length), this.#options.configuration?.keyPublic);
					const { sub, sid } = payload;
					if (isID("id_", sub) && isID("ses_", sid)) {
						await this.#options.kv.delete(`auth/identity/${sub}/session/${sid}`, options);
					}
				} else if (authorization.startsWith("Token ")) {
					throw "TODO!";
				}
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	async #createTokens(
		identity: Identity,
		issuedAt: number,
		sessionId: ID<"ses_">,
		scope: string[],
	): Promise<AuthenticationTokens> {
		return tracer.startActiveSpan("@baseless/server.facade.auth.createTokens", async (span) => {
			span.setAttribute("auth.identityId", identity.id.toString());
			span.setAttribute("auth.issuedAt", issuedAt);
			span.setAttribute("auth.sessionId", sessionId.toString());
			span.setAttribute("auth.scope", scope);
			try {
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
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	async createSession(
		identity: Identity,
		issuedAt: number,
		scope: string[],
		options?: { signal?: AbortSignal },
	): Promise<AuthenticationTokens> {
		return tracer.startActiveSpan("@baseless/server.facade.auth.createSession", async (span) => {
			span.setAttribute("auth.identityId", identity.id.toString());
			span.setAttribute("auth.issuedAt", issuedAt);
			span.setAttribute("auth.scope", JSON.stringify(scope));
			span.setAttribute("auth.options", JSON.stringify(options));
			try {
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
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	async refreshSession(refreshToken: string, options?: { signal?: AbortSignal }): Promise<AuthenticationTokens> {
		return tracer.startActiveSpan("@baseless/server.facade.auth.refreshSession", async (span) => {
			try {
				if (
					this.#options.configuration?.keyPublic === undefined ||
					this.#options.configuration === undefined ||
					!("keyPrivate" in this.#options.configuration)
				) {
					throw new Error("Authentication is not properly configured");
				}
				const { payload } = await jwtVerify(refreshToken, this.#options.configuration.keyPublic);
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
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
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
		return tracer.startActiveSpan("@baseless/server.facade.document.get", async (span) => {
			span.setAttribute("document.path", path);
			span.setAttribute("document.params", JSON.stringify(params));
			span.setAttribute("document.options", JSON.stringify(options));
			try {
				const key = resolvePath(path, params);
				try {
					// deno-lint-ignore no-var no-inner-declarations
					var _ = first(this.#options.app.match("document", key));
				} catch (cause) {
					throw new DocumentNotFoundError(undefined, { cause });
				}

				return this.#options.provider.get(key, options);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	getMany<TPath extends keyof any & string>(
		keys: Array<[path: TPath, params: PathToParams<TPath>]>,
		options?: DocumentGetOptions,
	): Promise<Array<Document<any>>> {
		return tracer.startActiveSpan("@baseless/server.facade.document.getMany", async (span) => {
			span.setAttribute("document.keys", JSON.stringify(keys));
			span.setAttribute("document.options", JSON.stringify(options));
			try {
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
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
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

	async commit(options?: { signal?: AbortSignal }): Promise<void> {
		return tracer.startActiveSpan("@baseless/server.facade.document.atomic.commit", async (span) => {
			span.setAttribute("atomic.checks", JSON.stringify(this.checks));
			span.setAttribute("atomic.operations", JSON.stringify(this.operations));
			span.setAttribute("atomic.options", JSON.stringify(options));
			try {
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
							const [_, definition] = first(this.#options.app.match("collection", collectionKey));
							messages.push({
								key: collectionKey,
								payload: { type: "set", document } as never,
							});
						} catch (_cause) {}
						for (
							const [params, definition] of this.#options.app.match("onDocumentSetting", op.key)
						) {
							await tracer.startActiveSpan("@baseless/server.facade.document.atomic.onDocumentSetting", async (span) => {
								span.setAttribute("onDocumentSetting.path", definition.path);
								span.setAttribute("onDocumentSetting.params", JSON.stringify(params));
								try {
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
								} catch (cause) {
									span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
									span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
									throw cause;
								} finally {
									span.end();
								}
							});
						}
					} else {
						atomic.delete(op.key);
						messages.push({ key: op.key, payload: { type: "deleted" } as never });
						for (
							const [params, definition] of this.#options.app.match("onDocumentDeleting", op.key)
						) {
							await tracer.startActiveSpan("@baseless/server.facade.document.atomic.onDocumentSetting", async (span) => {
								span.setAttribute("onDocumentSetting.path", definition.path);
								span.setAttribute("onDocumentSetting.params", JSON.stringify(params));
								try {
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
								} catch (cause) {
									span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
									span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
									throw cause;
								} finally {
									span.end();
								}
							});
						}
					}
				}
				await atomic.commit(options);

				for (const { key, payload } of messages) {
					this.#options.waitUntil(this.#options.service.pubsub.publish(key as never, {} as never, payload, { signal }));
				}
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
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

	async publish<TTopic extends keyof any & string>(
		path: TTopic,
		params: PathToParams<TTopic>,
		payload: any,
		options?: { signal?: AbortSignal },
	): Promise<void> {
		return tracer.startActiveSpan("@baseless/server.facade.pubsub.publish", async (span) => {
			span.setAttribute("pubsub.path", path);
			span.setAttribute("pubsub.params", JSON.stringify(params));
			span.setAttribute("pubsub.payload", JSON.stringify(payload));
			try {
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
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
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

	async notify(identityId: Identity["id"], notification: Notification, options?: { signal?: AbortSignal }): Promise<boolean> {
		return tracer.startActiveSpan("@baseless/server.facade.notification.notify", async (span) => {
			span.setAttribute("notification.identityId", identityId.toString());
			span.setAttribute("notification.notification", JSON.stringify(notification));
			span.setAttribute("notification.options", JSON.stringify(options));
			try {
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
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	async notifyChannel(
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
		return tracer.startActiveSpan("@baseless/server.facade.notification.unsafeNotifyChannel", async (span) => {
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
		return tracer.startActiveSpan("@baseless/server.facade.ratelimiter.limit", async (span) => {
			span.setAttribute("ratelimiter.key", options.key);
			span.setAttribute("ratelimiter.limit", options.limit);
			span.setAttribute("ratelimiter.period", options.period);
			try {
				return this.#provider.limit(options);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
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

	async execute<TParams extends Record<string, unknown>, TOutput>(
		statement: TStatement<TParams, TOutput>,
		params: TParams,
		options?: { signal?: AbortSignal },
	): Promise<TOutput> {
		return tracer.startActiveSpan("@baseless/server.facade.table.execute", async (span) => {
			span.setAttribute("table.statement", JSON.stringify(statement));
			span.setAttribute("table.params", JSON.stringify(params));
			try {
				return await this.#provider.execute(statement as TStatement<Record<string, unknown>, unknown>, params, options) as TOutput;
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
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
		return tracer.startActiveSpan("@baseless/server.facade.storage.getMetadata", async (span) => {
			span.setAttribute("storage.path", path);
			span.setAttribute("storage.params", JSON.stringify(params));
			span.setAttribute("storage.options", JSON.stringify(options));
			try {
				const key = resolvePath(path, params);
				try {
					const _ = first(this.#options.app.match("file", key));
				} catch (cause) {
					throw new StorageObjectNotFoundError(undefined, { cause });
				}
				return this.#options.storageProvider.getMetadata(key, options);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	getSignedUploadUrl<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: StorageSignedUploadUrlOptions,
	): Promise<StorageSignedUrl> {
		return tracer.startActiveSpan("@baseless/server.facade.storage.getSignedUploadUrl", async (span) => {
			span.setAttribute("storage.path", path);
			span.setAttribute("storage.params", JSON.stringify(params));
			span.setAttribute("storage.options", JSON.stringify(options));
			try {
				const key = resolvePath(path, params);
				try {
					const _ = first(this.#options.app.match("file", key));
				} catch (cause) {
					throw new StorageObjectNotFoundError(undefined, { cause });
				}
				return this.#options.storageProvider.getSignedUploadUrl(key, options);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	getSignedDownloadUrl<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: StorageSignedDownloadUrlOptions,
	): Promise<StorageSignedUrl> {
		return tracer.startActiveSpan("@baseless/server.facade.storage.getSignedDownloadUrl", async (span) => {
			span.setAttribute("storage.path", path);
			span.setAttribute("storage.params", JSON.stringify(params));
			span.setAttribute("storage.options", JSON.stringify(options));
			try {
				const key = resolvePath(path, params);
				try {
					const _ = first(this.#options.app.match("file", key));
				} catch (cause) {
					throw new StorageObjectNotFoundError(undefined, { cause });
				}
				return this.#options.storageProvider.getSignedDownloadUrl(key, options);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	async put<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		content: ReadableStream<Uint8Array> | ArrayBuffer | Blob,
		options?: StoragePutOptions,
	): Promise<void> {
		return tracer.startActiveSpan("@baseless/server.facade.storage.put", async (span) => {
			span.setAttribute("storage.path", path);
			span.setAttribute("storage.params", JSON.stringify(params));
			span.setAttribute("storage.options", JSON.stringify(options));
			try {
				const key = resolvePath(path, params);
				try {
					const _ = first(this.#options.app.match("file", key));
				} catch (cause) {
					throw new StorageObjectNotFoundError(undefined, { cause });
				}
				await this.#options.storageProvider.put(key, content, options);
				const file = await this.#options.storageProvider.getMetadata(key);
				this.#options.waitUntil(this.#options.queueProvider.enqueue({ type: "file_uploaded", key: key as never, file }));
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	get<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: { signal?: AbortSignal },
	): Promise<ReadableStream<Uint8Array>> {
		return tracer.startActiveSpan("@baseless/server.facade.storage.get", async (span) => {
			span.setAttribute("storage.path", path);
			span.setAttribute("storage.params", JSON.stringify(params));
			try {
				const key = resolvePath(path, params);
				try {
					const _ = first(this.#options.app.match("file", key));
				} catch (cause) {
					throw new StorageObjectNotFoundError(undefined, { cause });
				}
				return this.#options.storageProvider.get(key, options);
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
		});
	}

	async delete<TPath extends keyof any & string>(
		path: TPath,
		params: PathToParams<TPath>,
		options?: { signal?: AbortSignal },
	): Promise<void> {
		return tracer.startActiveSpan("@baseless/server.facade.storage.delete", async (span) => {
			span.setAttribute("storage.path", path);
			span.setAttribute("storage.params", JSON.stringify(params));
			try {
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
			} catch (cause) {
				span.recordException(cause instanceof Error ? cause : new Error(String(cause)));
				span.setStatus({ code: 2, message: cause instanceof Error ? cause.message : String(cause) });
				throw cause;
			} finally {
				span.end();
			}
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
