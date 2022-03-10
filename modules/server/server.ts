import {
	IMessageProvider,
	NoopAuthProvider,
	NoopChannelProvider,
	NoopDatabaseProvider,
	NoopKVProvider,
	NoopMailProvider,
	NoopMessageProvider,
} from "https://baseless.dev/x/provider/mod.ts";
import type {
	IAuthProvider,
	IChannelProvider,
	IClientProvider,
	IDatabaseProvider,
	IKVProvider,
	IMailProvider,
} from "https://baseless.dev/x/provider/mod.ts";
import { logger } from "https://baseless.dev/x/logger/mod.ts";
import { AuthController } from "./auth.ts";
import { DatabaseController } from "./database.ts";
import { MessageController } from "./message.ts";
import { commandValidator } from "./schema.ts";
import type { Command, Commands, Result, Results } from "./schema.ts";
import type { AuthIdentifier } from "https://baseless.dev/x/shared/auth.ts";
import { UnknownError } from "https://baseless.dev/x/shared/server.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.3.7/jwt/verify.ts";
import type { Context } from "https://baseless.dev/x/provider/context.ts";
import { collection, doc } from "https://baseless.dev/x/shared/database.ts";
import { ClientNotFoundError } from "https://baseless.dev/x/shared/client.ts";
import type {
	AuthDescriptor,
	DatabaseDescriptor,
	FunctionsDescriptor,
	FunctionsHttpHandler,
	MailDescriptor,
	MessageDescriptor,
} from "https://baseless.dev/x/worker/mod.ts";

export class Server {
	private logger = logger("server");
	private authController: AuthController;
	private databaseController: DatabaseController;
	private messageController: MessageController;

	public constructor(
		private authDescriptor: AuthDescriptor,
		private databaseDescriptor: DatabaseDescriptor,
		private functionsDescriptor: FunctionsDescriptor,
		private mailDescriptor: MailDescriptor,
		private messageDescriptor: MessageDescriptor,
		private clientProvider: IClientProvider,
		private authProvider: IAuthProvider = new NoopAuthProvider(),
		private kvProvider: IKVProvider = new NoopKVProvider(),
		private databaseProvider: IDatabaseProvider = new NoopDatabaseProvider(),
		private mailProvider: IMailProvider = new NoopMailProvider(),
		private messageProvider: IMessageProvider = new NoopMessageProvider(),
		private channelProvider: IChannelProvider = new NoopChannelProvider(),
	) {
		this.authController = new AuthController(this.authDescriptor);
		this.databaseController = new DatabaseController(this.databaseDescriptor);
		this.messageController = new MessageController(this.messageDescriptor, this.messageProvider);
	}

	/**
	 * Handle a `Request` that may contain a set of `Commands`
	 */
	public async handleRequest(
		request: Request,
	): Promise<[Response, PromiseLike<unknown>[]]> {
		const responseInit: ResponseInit = {
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Headers": "Origin, Authorization, Content-Type, X-BASELESS-CLIENT-ID",
			},
		};

		// Request must include a clientid in it's header
		if (!request.headers.has("X-BASELESS-CLIENT-ID")) {
			return [
				new Response(null, {
					...responseInit,
					status: 401,
				}),
				[],
			];
		}

		const client_id = request.headers.get("X-BASELESS-CLIENT-ID") ?? "";
		const client = await this.clientProvider?.getClientById(client_id).catch((_) => undefined);

		// Clientid must match a registered client
		if (!client) {
			this.logger.info(`Client ID "${client_id}" not found.`);
			return [
				new Response(null, {
					...responseInit,
					status: 401,
				}),
				[],
			];
		}

		const originUrl = request.headers.get("Origin");

		// Request's Origin be in client's url
		if (!originUrl || !client.url.some((url) => url.indexOf(originUrl) > -1)) {
			this.logger.info(
				`Request's Origin not allowed for client "${client_id}".`,
			);
			return [
				new Response(null, {
					...responseInit,
					status: 401,
				}),
				[],
			];
		}

		responseInit.headers = {
			...responseInit.headers,
			"Access-Control-Allow-Origin": originUrl,
		};

		let currentUserId: AuthIdentifier | undefined;
		if (request.headers.get("Authorization")) {
			const authorization = request.headers.get("Authorization") ?? "";
			const match = authorization.match(/(?<scheme>[^ ]+) (?<params>.+)/);
			if (match) {
				const scheme = match.groups?.scheme.toLowerCase() ?? "";
				const params = match.groups?.params ?? "";
				if (scheme === "bearer") {
					try {
						const { payload } = await jwtVerify(params, client.publicKey, {
							issuer: client.principal,
							audience: client.principal,
						});
						currentUserId = payload.sub ?? "";
					} catch (err) {
						this.logger.warn(
							`Could not parse Authorization header, got error : ${err}`,
						);
					}
				} else {
					this.logger.warn(
						`Unknown authorization scheme "${scheme}".`,
					);
				}
			}
		}

		const waitUntilCollection: PromiseLike<unknown>[] = [];
		const context: Context = {
			client,
			currentUserId,
			auth: this.authProvider,
			kv: this.kvProvider,
			database: this.databaseProvider,
			mail: this.mailProvider,
			channel: this.channelProvider,
			waitUntil(promise) {
				waitUntilCollection.push(promise);
			},
		};

		const url = new URL(request.url);
		this.logger.info(`${request.method} ${url.pathname}`);

		if (request.method === "OPTIONS") {
			return [
				new Response(null, {
					...responseInit,
					status: 200,
				}),
				waitUntilCollection,
			];
		}

		if (url.pathname.length > 1) {
			const fnName = url.pathname.substring(1);
			const desc = this.functionsDescriptor.getHttp(fnName);
			if (desc) {
				try {
					const result = await desc.onCall(request, context);
					const response = new Response(result.body, {
						...responseInit,
						status: result.status,
						statusText: result.statusText,
						headers: { ...responseInit.headers, ...result.headers },
					});
					return [response, waitUntilCollection];
				} catch (err) {
					this.logger.error(`Function "${fnName}" encountered an error. Got ${err}`);
					return [
						new Response(null, { ...responseInit, status: 500 }),
						waitUntilCollection,
					];
				}
			} else {
				this.logger.warn(`Function "${fnName}" is not registered as HTTP function.`);
			}
			return [
				new Response(null, { ...responseInit, status: 405 }),
				waitUntilCollection,
			];
		}

		let commands: Commands | undefined;
		const contentType = request.headers.get("Content-Type")?.toLocaleLowerCase();
		switch (contentType) {
			case "application/json": {
				let body = "";
				if (request.body) {
					const buffer = await new Response(request.body).arrayBuffer();
					body = new TextDecoder().decode(buffer);
				}

				try {
					commands = JSON.parse(body);
				} catch (err) {
					this.logger.error(`Could not parse JSON body, got error : ${err}`);
					return [
						new Response(null, { ...responseInit, status: 400 }),
						waitUntilCollection,
					];
				}

				const result = commandValidator.validate(commands);
				if (!result.valid) {
					this.logger.error(
						`JSON body did not validate againts schema, got error : ${result.errors}`,
					);
					// TODO if production?
					return [
						new Response(JSON.stringify(result.errors), {
							...responseInit,
							status: 400,
						}),
						waitUntilCollection,
					];
				}

				break;
			}
			default:
				this.logger.error(`Expected JSON payload, got "${contentType}".`);
				return [
					new Response(null, { ...responseInit, status: 400 }),
					waitUntilCollection,
				];
		}

		// Request did not contain any valid commands
		if (!commands) {
			return [
				new Response(null, { ...responseInit, status: 400 }),
				waitUntilCollection,
			];
		}

		const promises = Object.entries(commands)
			.map(([key, cmd]) => {
				return this.processCommand(context, cmd)
					.then((result) => [key, result] as const)
					.catch((err: unknown) => {
						if (err instanceof Error) {
							return [key, { error: err.name }] as const;
						}
						this.logger.warn(`Unknown error, got ${err}`);
						return [key, { error: "UnknownError" }] as const;
					});
			});

		const responses = await Promise.all(promises);
		const results = responses.reduce((results, [key, result]) => {
			results[key] = result;
			return results;
		}, {} as Results);

		return [
			new Response(JSON.stringify(results), { ...responseInit, status: 200 }),
			waitUntilCollection,
		];
	}

	/**
	 * Handle a `Request` that may contain a set of `Commands`
	 */
	public async handleWebSocket(
		request: Request,
		upgrader: (request: Request) => Promise<[Response, WebSocket | null]>,
	): Promise<[Response, PromiseLike<unknown>[]]> {
		const responseInit: ResponseInit = {
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Headers": "Origin, Authorization, Content-Type, X-BASELESS-CLIENT-ID",
			},
		};

		const url = new URL(request.url);

		// Request must include a client_id in it's params
		if (url.searchParams.get("client_id") === null) {
			return [
				new Response(null, {
					...responseInit,
					status: 401,
				}),
				[],
			];
		}

		const client_id = url.searchParams.get("client_id") ?? "";
		const client = await this.clientProvider?.getClientById(client_id).catch((_) => undefined);

		// Clientid must match a registered client
		if (!client) {
			this.logger.info(`Client ID "${client_id}" not found.`);
			return [
				new Response(null, {
					...responseInit,
					status: 401,
				}),
				[],
			];
		}

		let currentUserId: AuthIdentifier | undefined;
		if (url.searchParams.get("access_token")) {
			const access_token = url.searchParams.get("access_token") ?? "";
			try {
				const { payload } = await jwtVerify(access_token, client.publicKey, {
					issuer: client.principal,
					audience: client.principal,
				});
				currentUserId = payload.sub ?? "";
			} catch (err) {
				this.logger.warn(
					`Could not parse access_token param, got error : ${err}`,
				);
			}
		}

		const waitUntilCollection: PromiseLike<unknown>[] = [];
		const context: Context = {
			client,
			currentUserId,
			auth: this.authProvider,
			kv: this.kvProvider,
			database: this.databaseProvider,
			mail: this.mailProvider,
			channel: this.channelProvider,
			waitUntil(promise) {
				waitUntilCollection.push(promise);
			},
		};

		try {
			return this.messageController.accept(request, context, upgrader);
		} catch (err) {
			this.logger.warn(
				`Could not accept WebSocket, got error : ${err}`,
			);
			return [
				new Response(null, {
					...responseInit,
					status: 500,
				}),
				[],
			];
		}
	}

	/**
	 * Handle a command
	 */
	public async handleCommand(clientId: string, access_token: string | undefined, command: Command): Promise<Result> {
		const client = await this.clientProvider?.getClientById(clientId);
		if (!client) {
			throw new ClientNotFoundError();
		}

		let currentUserId: AuthIdentifier | undefined;

		if (access_token) {
			try {
				const { payload } = await jwtVerify(access_token, client.publicKey, {
					issuer: client.principal,
					audience: client.principal,
				});
				currentUserId = payload.sub ?? "";
			} catch (err) {
				this.logger.warn(
					`Could not parse Authorization header, got error : ${err}`,
				);
			}
		}

		const waitUntilCollection: PromiseLike<unknown>[] = [];
		const context: Context = {
			client,
			currentUserId,
			auth: this.authProvider,
			kv: this.kvProvider,
			database: this.databaseProvider,
			mail: this.mailProvider,
			channel: this.channelProvider,
			waitUntil(promise) {
				waitUntilCollection.push(promise);
			},
		};

		return this.processCommand(context, command);
	}

	/**
	 * Handle a command
	 */
	protected processCommand(context: Context, cmd: Command): Promise<Result> {
		let p: Promise<Result>;
		if (cmd.cmd === "auth.signin-anonymously") {
			p = this.authController.createAnonymousUser(context);
		} else if (cmd.cmd === "auth.add-sign-with-email-password") {
			p = this.authController.addSignWithEmailPassword(
				context,
				cmd.locale,
				cmd.email,
				cmd.password,
			);
		} else if (cmd.cmd === "auth.create-user-with-email-password") {
			p = this.authController.createUserWithEmail(
				context,
				cmd.locale,
				cmd.email,
				cmd.password,
				cmd.claimAnonymousId,
			);
		} else if (cmd.cmd === "auth.send-email-validation-code") {
			p = this.authController.sendValidationEmail(
				context,
				cmd.locale,
				cmd.email,
			);
		} else if (cmd.cmd === "auth.validate-email") {
			p = this.authController.validateEmailWithCode(
				context,
				cmd.email,
				cmd.code,
			);
		} else if (cmd.cmd === "auth.send-password-reset-code") {
			p = this.authController.sendPasswordResetEmail(
				context,
				cmd.locale,
				cmd.email,
			);
		} else if (cmd.cmd === "auth.reset-password") {
			p = this.authController.resetPasswordWithCode(
				context,
				cmd.email,
				cmd.code,
				cmd.password,
			);
		} else if (cmd.cmd === "auth.update-password") {
			p = this.authController.updatePassword(
				context,
				cmd.newPassword,
			);
		} else if (cmd.cmd === "auth.signin-with-email-password") {
			p = this.authController.signWithEmailPassword(
				context,
				cmd.email,
				cmd.password,
			);
		} else if (cmd.cmd === "auth.refresh-tokens") {
			p = this.authController.refreshTokens(
				context,
				cmd.refresh_token,
			);
		} else if (cmd.cmd === "db.get") {
			p = this.databaseController.get(
				context,
				doc(cmd.ref),
			);
		} else if (cmd.cmd === "db.list") {
			p = this.databaseController.list(
				context,
				collection(cmd.ref),
				cmd.filter,
			);
		} else if (cmd.cmd === "db.create") {
			p = this.databaseController.create(
				context,
				doc(cmd.ref),
				cmd.metadata,
				cmd.data,
			);
		} else if (cmd.cmd === "db.update") {
			p = this.databaseController.update(
				context,
				doc(cmd.ref),
				cmd.metadata,
				cmd.data,
				cmd.replace,
			);
		} else if (cmd.cmd === "db.delete") {
			p = this.databaseController.delete(
				context,
				doc(cmd.ref),
			);
		} else {
			p = Promise.reject(new UnknownError());
		}
		return p;
	}
}
