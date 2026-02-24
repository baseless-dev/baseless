// deno-lint-ignore-file no-explicit-any
import { App, AppRegistry, EndpointDefinition, Permission, TopicMessage } from "./app.ts";
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
import { DocumentFacade, KVFacade, NotificationFacade, PubSubFacade, RateLimiterFacade } from "./facade.ts";
import { first } from "@baseless/core/iter";
import { decodeBase64Url } from "@std/encoding/base64url";
import { type ID, id, isID } from "@baseless/core/id";
import * as z from "@baseless/core/schema";
import type { QueueItem } from "@baseless/core/queue";
import { jwtVerify, type KeyLike } from "jose";
import {
	BadGatewayError,
	BadRequestError,
	ForbiddenError,
	PublicError,
	RequestNotFoundError,
	TopicNotFoundError,
} from "@baseless/core/errors";
import { Request } from "@baseless/core/request";
import { Response } from "@baseless/core/response";

/**
 * Construction options for {@link Server}.
 *
 * @template TRegistry The server's app registry.
 */
export interface ServerOptions<TRegistry extends AppRegistry> {
	configuration: Omit<TRegistry["configuration"], "server">;
	publicKey?: KeyLike;
	app: App<TRegistry>;
	providers: {
		document: DocumentProvider;
		channels: Record<string, NotificationChannelProvider>;
		hub: HubProvider;
		kv: KVProvider;
		queue: QueueProvider;
		rateLimiter: RateLimiterProvider;
	};
}

/**
 * The Baseless HTTP/WebSocket server. Handles incoming requests, delegates to
 * the registered endpoints, processes hub (WebSocket) messages, and drains
 * the queue.
 *
 * @template TRegistry The server's app registry.
 *
 * @example
 * ```ts
 * import { Server } from "@baseless/server";
 *
 * const server = new Server({ app, configuration, providers });
 * Deno.serve((req) => server.handleRequest(req).then(([res]) => res));
 * ```
 */
export class Server<TRegistry extends AppRegistry> {
	options: ServerOptions<TRegistry>;

	constructor(options: ServerOptions<TRegistry>) {
		this.options = options;
	}

	/**
	 * Builds the request context (decoration + services) for a single request.
	 * @param request The incoming request.
	 * @param auth The resolved authentication principal (or `undefined`).
	 * @param signal Abort signal tied to the request lifecycle.
	 * @param waitUntil Callback to register background work.
	 * @returns The populated `context` and `service` objects.
	 */
	async createContext(
		request: Request<any, any, any, any>,
		auth: Auth,
		signal: AbortSignal,
		waitUntil: (promise: PromiseLike<unknown>) => void,
	): Promise<{
		context: AppRegistry["context"];
		service: ServiceCollection;
	}> {
		// const context: TRegistry["context"] = { ...this.#requirements };
		const context: AppRegistry["context"] = {};
		const service: ServiceCollection = {
			document: {} as never,
			kv: new KVFacade(this.options.providers.kv),
			notification: {} as never,
			pubsub: {} as never,
			rateLimiter: new RateLimiterFacade(this.options.providers.rateLimiter),
		};
		service.document = new DocumentFacade({
			app: this.options.app,
			auth,
			configuration: {}, // TODO
			context,
			provider: this.options.providers.document,
			service: service,
			waitUntil,
		});
		service.notification = new NotificationFacade({
			providers: this.options.providers.channels,
			service: service,
		});
		service.pubsub = new PubSubFacade({
			app: this.options.app,
			provider: this.options.providers.queue,
		});
		for (const decorator of this.options.app.services) {
			const services = decorator instanceof Function
				? await decorator({
					app: this.options.app,
					auth,
					configuration: this.options.configuration,
					request: request as never,
					signal,
					waitUntil,
				})
				: decorator;
			Object.assign(service, services);
		}
		for (const decorator of this.options.app.decorators) {
			const decorations = decorator instanceof Function
				? await decorator({
					app: this.options.app,
					auth,
					configuration: this.options.configuration,
					request: request as never,
					service,
					signal,
					waitUntil,
				})
				: decorator;
			Object.assign(context, decorations);
		}
		return { context, service };
	}

	async #parseAuthorization(authorization: string): Promise<Auth> {
		if (this.options.publicKey === undefined) {
			return undefined;
		} else if (authorization.startsWith("Bearer ")) {
			try {
				const { payload } = await jwtVerify(authorization.slice("Bearer ".length), this.options.publicKey);
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

	/**
	 * Handles a native `Request` (HTTP or WebSocket upgrade) and returns a
	 * native `Response` along with any background promises.
	 * @param nativeRequest The incoming native HTTP request.
	 * @returns A tuple of `[response, waitUntil promises]`.
	 */
	async handleRequest(nativeRequest: globalThis.Request): Promise<[response: globalThis.Response, waitUntil: Array<PromiseLike<unknown>>]> {
		const promises: Array<PromiseLike<unknown>> = [];
		const waitUntil = (promise: PromiseLike<unknown>) => promises.push(promise);
		const url = new URL(nativeRequest.url);
		try {
			const upgrade = nativeRequest.headers.get("Upgrade")?.toLowerCase();
			if (upgrade === "websocket") {
				// Request in a websocket upgrade might be special like in Deno, do not alter it
				const protocols = nativeRequest.headers.get("Sec-WebSocket-Protocol")?.split(",") ?? [];
				// Same method used in Kubernetes
				// https://github.com/kubernetes/kubernetes/commit/714f97d7baf4975ad3aa47735a868a81a984d1f0
				const encodedBearer = protocols.find((protocol) => protocol.startsWith("base64url.bearer.authorization.baseless.dev."));
				let authorization: string | undefined;
				if (encodedBearer) {
					const base64Decoded = decodeBase64Url(encodedBearer.slice(44));
					authorization = `Bearer ${new TextDecoder().decode(base64Decoded)}`;
				} else {
					authorization = nativeRequest.headers.get("Authorization") ?? undefined;
				}

				const auth = authorization ? await this.#parseAuthorization(authorization) : undefined;

				// TODO onHubConnect
				const { context } = await this.createContext(nativeRequest as never, auth, nativeRequest.signal, waitUntil);
				const hubId = id("hub_");
				const response = await this.options.providers.hub.transfer({
					app: this.options.app,
					auth,
					configuration: this.options.configuration,
					context,
					hubId,
					request: nativeRequest,
					server: this,
					signal: nativeRequest.signal,
				});
				return [response, promises];
			}

			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(
					this.options.app.match("endpoint", url.pathname.slice(1) + `/#${nativeRequest.method.toLowerCase()}`),
				);
			} catch (cause) {
				throw new RequestNotFoundError(undefined, { cause });
			}

			const request = await Request.from(nativeRequest);

			if (!z.guard(definition.request, request)) {
				throw new BadRequestError();
			}

			const response = await this.unsafe_handleRequest({
				definition,
				params,
				request: request as never,
				waitUntil,
			});

			if (!z.guard(definition.response, response)) {
				throw new BadGatewayError();
			}

			return [response.toResponse(), promises];
		} catch (cause) {
			let status = 500;
			let statusText = "Internal Server Error";
			let error = "Error";
			let details: unknown = undefined;
			if (cause instanceof z.ZodError) {
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
				globalThis.Response.json({ error, details }, { status, statusText }),
				promises,
			];
		}
	}

	/**
	 * Processes a message from a connected WebSocket hub client (subscribe,
	 * unsubscribe, or publish).
	 * @param hubId The hub connection identifier.
	 * @param auth The hub connection's authentication principal.
	 * @param message The raw WebSocket message payload.
	 * @returns Background promises to await after the message is processed.
	 */
	async handleHubMessage(hubId: ID<"hub_">, auth: Auth, message: unknown): Promise<Array<PromiseLike<unknown>>> {
		const promises: Array<PromiseLike<unknown>> = [];
		const waitUntil = (promise: PromiseLike<unknown>) => promises.push(promise);
		const abortController = new AbortController();
		const request = await Request.from(new globalThis.Request("http://hub"));

		const { type, ...rest } = await new globalThis.Response(message as never).json();

		const { context, service } = await this.createContext(request, auth, abortController.signal, waitUntil);

		if (type === "subscribe") {
			const { key } = rest;
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(this.options.app.match("topic", key));
			} catch (_error) {
				throw new TopicNotFoundError();
			}

			if ("security" in definition) {
				const permission = await definition.security({
					app: this.options.app,
					auth,
					configuration: this.options.configuration,
					context,
					params,
					service,
					signal: abortController.signal,
					waitUntil,
				});
				if ((permission & Permission.Subscribe) == 0) {
					throw new ForbiddenError();
				}
				await this.options.providers.hub.subscribe(key, hubId);
			}
		} else if (type === "unsubscribe") {
			const { key } = rest;
			try {
				// deno-lint-ignore no-var no-inner-declarations no-redeclare
				var [_, definition] = first(this.options.app.match("topic", key));
			} catch (_error) {
				throw new TopicNotFoundError();
			}

			if ("security" in definition) {
				await this.options.providers.hub.unsubscribe(key, hubId);
			}
		} else if (type === "publish") {
			const { key, payload } = rest;
			try {
				// deno-lint-ignore no-redeclare no-var no-inner-declarations
				var [params, definition] = first(this.options.app.match("topic", key));
			} catch (_error) {
				throw new TopicNotFoundError();
			}

			if ("security" in definition) {
				const permission = await definition.security({
					app: this.options.app,
					auth,
					configuration: this.options.configuration,
					context,
					params,
					service,
					signal: abortController.signal,
					waitUntil,
				});
				if ((permission & Permission.Publish) == 0) {
					throw new ForbiddenError();
				}

				await service.pubsub.publish(key as never, payload as never, abortController.signal);
			}
		}

		return promises;
	}

	/**
	 * Processes a dequeued {@link QueueItem}, dispatching it to the registered
	 * `onTopicMessage` handlers and publishing it to the hub provider.
	 * @param item The queue item to process.
	 * @returns Background promises to await after processing.
	 */
	async handleQueueItem(item: QueueItem): Promise<Array<PromiseLike<unknown>>> {
		const promises: Array<PromiseLike<unknown>> = [];
		const waitUntil = (promise: PromiseLike<unknown>) => promises.push(promise);
		const abortController = new AbortController();
		const request = await Request.from(new globalThis.Request("http://hub"));

		const { context, service } = await this.createContext(request, undefined, abortController.signal, waitUntil);

		if (item.type === "topic_publish") {
			const { key, payload } = item.payload as { key: string; payload: unknown };

			const message: TopicMessage<unknown> = {
				topic: key,
				data: payload,
				stopPropagation: false,
				stopImmediatePropagation: false,
			};

			for (const [params, definition] of this.options.app.match("onTopicMessage", key)) {
				await definition.handler({
					app: this.options.app,
					auth: undefined,
					configuration: this.options.configuration,
					context,
					message: message as never,
					params: params as never,
					service,
					signal: abortController.signal,
					waitUntil,
				});
				if (message.stopImmediatePropagation) {
					break;
				}
			}
			if (!message.stopPropagation) {
				await this.options.providers.hub.publish(key, payload);
			}
		}

		return promises;
	}

	/**
	 * Executes a matched endpoint definition without HTTP-layer validation.
	 * Useful for server-side service-to-service calls.
	 * @param options The matched definition, request, path params, and
	 * waitUntil callback.
	 * @returns The handler's {@link Response}.
	 */
	async unsafe_handleRequest({
		definition,
		params,
		request,
		waitUntil,
	}: {
		definition: EndpointDefinition<
			AppRegistry,
			string,
			z.ZodRequest,
			z.ZodResponse | z.ZodUnion<z.ZodResponse[]>
		>;
		request: Request<any, any, any, any>;
		params: Record<string, string>;
		waitUntil: (promise: PromiseLike<unknown>) => void;
	}): Promise<Response<any, any, any>> {
		const authorization = request.headers.get("Authorization");
		const auth = authorization ? await this.#parseAuthorization(authorization) : undefined;

		const { context, service } = await this.createContext(request, auth, request.signal, waitUntil);
		const output = definition.handler instanceof Function
			? await definition.handler({
				app: this.options.app,
				auth,
				configuration: this.options.configuration,
				context,
				params,
				request: request as never,
				service,
				signal: request.signal,
				waitUntil,
			})
			: definition.handler;
		return output;
	}
}
