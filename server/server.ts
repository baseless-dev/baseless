// deno-lint-ignore-file no-explicit-any
import {
	document,
	Permission,
	type RegisteredContext,
	type RegisteredRequirements,
	type TCollection,
	type TDecoration,
	type TDefinition,
	type TDocument,
	type TOnDocumentDeleting,
	type TOnDocumentSetting,
	type TOnRequest,
	type TOnTopicMessage,
	topic,
	type TopicMessage,
	type TTopic,
} from "./app.ts";
import {
	type Auth,
	DocumentProvider,
	HubProvider,
	KVProvider,
	NotificationChannelProvider,
	QueueProvider,
	RateLimiterProvider,
} from "./provider.ts";
import type { ServiceCollection } from "./service.ts";
import { type Matcher, matchPath } from "@baseless/core/path";
import createDocumentApplication from "./applications/document.ts";
import createPubSubApplication from "./applications/pubsub.ts";
import { DocumentFacade, KVFacade, NotificationFacade, PubSubFacade, RateLimiterFacade } from "./facade.ts";
import { first } from "@baseless/core/iter";
import { decodeBase64Url } from "@std/encoding/base64url";
import { type ID, id, isID } from "@baseless/core/id";
import * as Type from "@baseless/core/schema";
import type { QueueItem } from "@baseless/core/queue";
import type { AuthenticationOptions } from "./applications/authentication.ts";
import createAuthenticationApplication from "./applications/authentication.ts";
import { jwtVerify } from "jose";
import { PublicError, RequestNotFoundError } from "@baseless/core/errors";

export interface ServerOptions {
	authentication?: AuthenticationOptions;
	definitions: Record<string, TDefinition>;
	providers: {
		document: DocumentProvider;
		channels: Record<string, NotificationChannelProvider>;
		hub: HubProvider;
		kv: KVProvider;
		queue: QueueProvider;
		rateLimiter: RateLimiterProvider;
	};
	requirements?: RegisteredRequirements;
}

export class Server {
	#authenticationOptions: AuthenticationOptions | undefined;
	#documentProvider: DocumentProvider;
	#kvProvider: KVProvider;
	#notificationChannelProvider: Record<string, NotificationChannelProvider>;
	#queueProvider: QueueProvider;
	#hubProvider: HubProvider;
	#rateLimiterProvider: RateLimiterProvider;
	#requirements: RegisteredRequirements;
	#decorations: TDecoration<any>[];
	#documents: TDocument<any, any>[];
	#collections: TCollection<any, any, any>[];
	#topics: TTopic<any, any>[];
	#onRequests: TOnRequest<any, any, any>[];
	#onRequestMatcher: Matcher<TOnRequest<any, any, any>>;
	#collectionMatcher: Matcher<TCollection<any, any, any>>;
	#documentMatcher: Matcher<TDocument<any, any>>;
	#onDocumentSettingMatcher: Matcher<TOnDocumentSetting>;
	#onDocumentDeletingMatcher: Matcher<TOnDocumentDeleting>;
	#topicMatcher: Matcher<TTopic<any, any>>;
	#onTopicMessageMatcher: Matcher<TOnTopicMessage>;

	constructor(options: ServerOptions) {
		this.#authenticationOptions = options.authentication;
		this.#documentProvider = options.providers.document;
		this.#kvProvider = options.providers.kv;
		this.#notificationChannelProvider = options.providers.channels;
		this.#queueProvider = options.providers.queue;
		this.#hubProvider = options.providers.hub;
		this.#rateLimiterProvider = options.providers.rateLimiter;
		this.#requirements = { ...options.requirements };

		const definitions = Object.values(options.definitions);

		if (this.#authenticationOptions) {
			definitions.push(...createAuthenticationApplication(this.#authenticationOptions));
		}

		if (definitions.some((definition) => definition.type === "topic" && definition.security)) {
			const topics = definitions.filter((value) => value.type === "topic");
			const topicMatcher = matchPath(topics);
			definitions.push(...createPubSubApplication(topicMatcher));
		}

		if (
			definitions.some((definition) => definition.type === "document" && definition.security) ||
			definitions.some((definition) => definition.type === "collection" && definition.security)
		) {
			const documents: TDocument<any, any>[] = [];
			const collections = definitions.filter((value) => value.type === "collection");
			for (const definition of definitions) {
				if (definition.type === "collection") {
					documents.push(document(definition.path + "/:key", definition.items, definition.documentSecurity));
				} else if (definition.type === "document") {
					documents.push(definition);
				}
			}
			const documentMatcher = matchPath(documents);
			const collectionMatcher = matchPath(collections);
			definitions.push(...createDocumentApplication(documentMatcher, collectionMatcher));
		}

		this.#decorations = definitions.filter((value) => value.type === "decoration");
		this.#onRequests = definitions.filter((value) => value.type === "on_request");
		this.#documents = definitions.filter((value) => value.type === "document");
		this.#collections = definitions.filter((value) => value.type === "collection");
		for (const definition of this.#collections) {
			this.#documents.push(document(definition.path + "/:key", definition.items, definition.documentSecurity));
		}
		this.#topics = definitions.filter((value) => value.type === "topic");
		for (const definition of this.#documents) {
			this.#topics.push(
				topic(definition.path, Type.Object({ type: Type.String(), document: definition.data }, ["type", "document"]), definition.security),
			);
		}

		// TODO validate no document overlap with collection
		// TODO validate no topic overlap with document
		// TODO validate no reserved identifier (e.g. from builtin apps)

		this.#onRequestMatcher = matchPath(this.#onRequests);
		this.#collectionMatcher = matchPath(this.#collections);
		this.#documentMatcher = matchPath(this.#documents);
		this.#topicMatcher = matchPath(this.#topics);
		this.#onDocumentSettingMatcher = matchPath(definitions.filter((value) => value.type === "on_document_setting"));
		this.#onDocumentDeletingMatcher = matchPath(
			definitions.filter((value) => value.type === "on_document_deleting"),
		);
		this.#onTopicMessageMatcher = matchPath(definitions.filter((value) => value.type === "on_topic_message"));
	}

	get onRequests(): ReadonlyArray<TOnRequest<any, any, any>> {
		return [...this.#onRequests];
	}

	async createContext(
		request: Request,
		auth: Auth,
		signal: AbortSignal,
		waitUntil: (promise: PromiseLike<unknown>) => void,
	): Promise<[RegisteredContext, ServiceCollection]> {
		const context: RegisteredContext = { ...this.#requirements };
		const service: ServiceCollection = {
			document: {} as never,
			kv: new KVFacade(this.#kvProvider),
			notification: {} as never,
			pubsub: {} as never,
			rateLimiter: new RateLimiterFacade(this.#rateLimiterProvider),
		};
		service.document = new DocumentFacade(
			auth,
			this.#documentProvider,
			service,
			context,
			waitUntil,
			this.#collectionMatcher,
			this.#documentMatcher,
			this.#onDocumentSettingMatcher,
			this.#onDocumentDeletingMatcher,
		);
		service.notification = new NotificationFacade(
			this.#notificationChannelProvider,
			service,
		);
		service.pubsub = new PubSubFacade(
			this.#queueProvider,
			this.#topicMatcher,
		);
		for (const decorator of this.#decorations) {
			const decorations = await decorator.handler({
				auth,
				request,
				service,
				signal,
				waitUntil,
			});
			Object.assign(context, decorations);
		}
		return [context, service];
	}

	async #parseAuthorization(authorization: string): Promise<Auth> {
		if (this.#authenticationOptions === undefined) {
			return undefined;
		} else if (authorization.startsWith("Bearer ")) {
			try {
				const { payload } = await jwtVerify(authorization.slice("Bearer ".length), this.#authenticationOptions.publicKey);
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
	}

	async handleRequest(request: Request): Promise<[response: Response, waitUntil: Array<PromiseLike<unknown>>]> {
		const promises: Array<PromiseLike<unknown>> = [];
		const waitUntil = (promise: PromiseLike<unknown>) => promises.push(promise);
		const url = new URL(request.url);
		try {
			const upgrade = request.headers.get("Upgrade")?.toLowerCase();
			if (upgrade === "websocket") {
				// Request in a websocket upgrade might be special like in Deno, do not alter it
				const protocols = request.headers.get("Sec-WebSocket-Protocol")?.split(",") ?? [];
				// Same method used in Kubernetes
				// https://github.com/kubernetes/kubernetes/commit/714f97d7baf4975ad3aa47735a868a81a984d1f0
				const encodedBearer = protocols.find((protocol) => protocol.startsWith("base64url.bearer.authorization.baseless.dev."));
				let authorization: string | undefined;
				if (encodedBearer) {
					const base64Decoded = decodeBase64Url(encodedBearer.slice(44));
					authorization = `Bearer ${new TextDecoder().decode(base64Decoded)}`;
				} else {
					authorization = request.headers.get("Authorization") ?? undefined;
				}

				const auth = authorization ? await this.#parseAuthorization(authorization) : undefined;

				// TODO onHubConnect
				const [context, _service] = await this.createContext(request, auth, request.signal, waitUntil);
				const hubId = id("hub_");
				const response = await this.#hubProvider.transfer({ auth, context, hubId, request, server: this, signal: request.signal });
				return [response, promises];
			}

			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(this.#onRequestMatcher(url.pathname.slice(1)));
			} catch (cause) {
				throw new RequestNotFoundError(undefined, { cause });
			}

			const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
			let input: unknown;
			if (contentType.startsWith("application/json")) {
				input = await request.json().catch((_) => undefined);
			} else if (contentType === "application/x-www-form-urlencoded") {
				input = Object.fromEntries(new URLSearchParams(await request.text()));
			} else if (contentType.startsWith("multipart/form-data")) {
				const form = await request.formData();
				input = Array.from(form.keys()).reduce(
					(body, key) => {
						const values = form.getAll(key);
						body[key] = values.length === 1 ? values[0] : values;
						return body;
					},
					{} as Record<string, unknown>,
				);
			} else {
				input = undefined;
			}

			Type.assert(definition.input, input);

			const output = await this.unsafe_handleRequest({
				handler: definition.handler,
				input,
				params,
				request,
				security: definition.security,
				waitUntil,
			});

			Type.assert(definition.output, output);

			return [output !== undefined ? Response.json(output) : new Response(), promises];
		} catch (cause) {
			let status = 500;
			let statusText = "Internal Server Error";
			let error = "Error";
			let details: unknown = undefined;
			if (cause instanceof Type.SchemaAssertionError) {
				status = 400;
				statusText = "Bad Request";
				error = cause.message;
			} else if (cause instanceof PublicError) {
				error = cause.constructor.name;
				status = cause.status;
				statusText = cause.statusText;
				details = cause.details;
			} else if (cause instanceof Error) {
				error = cause.constructor.name;
			}
			return [
				Response.json({ error, details }, { status, statusText }),
				promises,
			];
		}
	}

	async handleHubMessage(hubId: ID<"hub_">, auth: Auth, message: unknown): Promise<Array<PromiseLike<unknown>>> {
		const promises: Array<PromiseLike<unknown>> = [];
		const waitUntil = (promise: PromiseLike<unknown>) => promises.push(promise);
		const abortController = new AbortController();
		const request = new Request("http://hub");

		const { type, ...rest } = await new Response(message as never).json();

		const [context, service] = await this.createContext(request, auth, abortController.signal, waitUntil);

		if (type === "subscribe") {
			const { key } = rest;
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(this.#topicMatcher(key));
			} catch (_error) {
				throw "NOT_FOUND";
			}

			if (definition.security) {
				const permission = await definition.security({
					auth,
					context,
					params,
					service,
					signal: abortController.signal,
					waitUntil,
				});
				if ((permission & Permission.Subscribe) == 0) {
					throw "FORBIDDEN";
				}
			}

			await this.#hubProvider.subscribe(key, hubId);
		} else if (type === "unsubscribe") {
			const { key } = rest;
			try {
				const _ = first(this.#topicMatcher(key));
			} catch (_error) {
				throw "NOT_FOUND";
			}

			await this.#hubProvider.unsubscribe(key, hubId);
		} else if (type === "publish") {
			const { key, payload } = rest;
			try {
				// deno-lint-ignore no-redeclare no-var no-inner-declarations
				var [params, definition] = first(this.#topicMatcher(key));
			} catch (_error) {
				throw "NOT_FOUND";
			}

			if (definition.security) {
				const permission = await definition.security({
					auth,
					context,
					params,
					service,
					signal: abortController.signal,
					waitUntil,
				});
				if ((permission & Permission.Publish) == 0) {
					throw "FORBIDDEN";
				}
			}

			await service.pubsub.publish(key, payload, abortController.signal);
		}

		return promises;
	}

	async handleQueueItem(item: QueueItem): Promise<Array<PromiseLike<unknown>>> {
		const promises: Array<PromiseLike<unknown>> = [];
		const waitUntil = (promise: PromiseLike<unknown>) => promises.push(promise);
		const abortController = new AbortController();
		const request = new Request("http://hub");

		const [context, service] = await this.createContext(request, undefined, abortController.signal, waitUntil);

		if (item.type === "pubsub_message") {
			const { key, payload } = item.payload as { key: string; payload: unknown };

			const message: TopicMessage<unknown> = {
				topic: key,
				data: payload,
				stopPropagation: false,
				stopImmediatePropagation: false,
			};

			for (const [params, definition] of this.#onTopicMessageMatcher(key)) {
				await definition.handler({
					auth: undefined,
					context,
					message,
					params,
					service,
					signal: abortController.signal,
					waitUntil,
				});
				if (message.stopImmediatePropagation) {
					break;
				}
			}
			if (!message.stopPropagation) {
				await this.#hubProvider.publish(key, payload);
			}
		}

		return promises;
	}

	async unsafe_handleRequest({
		handler,
		input,
		params,
		request,
		security,
		waitUntil,
	}: {
		handler: TOnRequest<any, any, any>["handler"];
		input: unknown;
		params: Record<string, string>;
		request: Request;
		security: TOnRequest<any, any, any>["security"];
		waitUntil: (promise: PromiseLike<unknown>) => void;
	}): Promise<[result: unknown, waitUntil: Array<PromiseLike<unknown>>]> {
		const authorization = request.headers.get("Authorization");
		const auth = authorization ? await this.#parseAuthorization(authorization) : undefined;

		const [context, service] = await this.createContext(request, auth, request.signal, waitUntil);
		if (security) {
			const permission = await security({
				auth,
				context,
				params,
				input,
				request,
				service,
				signal: request.signal,
				waitUntil,
			});
			if ((permission & Permission.Fetch) == 0) {
				throw "FORBIDDEN";
			}
		}
		const output = await handler({
			auth,
			context,
			input,
			params,
			request,
			service,
			signal: request.signal,
			waitUntil,
		});
		return output;
	}
}
