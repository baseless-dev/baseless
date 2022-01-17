import {
	IAuthProvider,
	IClientProvider,
	IDatabaseProvider,
	IKVProvider,
	IMailProvider,
	NoopAuthProvider,
	NoopDatabaseProvider,
	NoopKVProvider,
	NoopMailProvider,
} from "https://baseless.dev/x/provider/deno/mod.ts";
import { logger } from "https://baseless.dev/x/logger/deno/mod.ts";
import { AuthController, AuthDescriptor } from "./auth.ts";
import { DatabaseController, DatabaseDescriptor } from "./database.ts";
import { FunctionsDescriptor, FunctionsHttpHandler } from "./functions.ts";
import { MailDescriptor } from "./mail.ts";
import { Commands, Result, Results, validator } from "./schema.ts";
import { AuthIdentifier } from "https://baseless.dev/x/shared/deno/auth.ts";
import { jwtVerify } from "https://deno.land/x/jose@v4.3.7/jwt/verify.ts";
import { Context } from "https://baseless.dev/x/provider/deno/context.ts";
import {
	collection,
	doc,
} from "https://baseless.dev/x/shared/deno/database.ts";

export class Server {
	private logger = logger("server");
	private functionsHttpMap = new Map<string, FunctionsHttpHandler>();
	private authController: AuthController;
	private databaseController: DatabaseController;

	public constructor(
		private authDescriptor: AuthDescriptor,
		private databaseDescriptor: DatabaseDescriptor,
		private functionsDescriptor: FunctionsDescriptor,
		private mailDescriptor: MailDescriptor,
		private clientProvider: IClientProvider,
		private authProvider: IAuthProvider = new NoopAuthProvider(),
		private kvProvider: IKVProvider = new NoopKVProvider(),
		private databaseProvider: IDatabaseProvider = new NoopDatabaseProvider(),
		private mailProvider: IMailProvider = new NoopMailProvider(),
	) {
		this.functionsHttpMap = new Map(
			functionsDescriptor.https.filter((http) => http.onCall).map(
				(http) => [http.path, http.onCall!],
			),
		);

		this.authController = new AuthController(this.authDescriptor);
		this.databaseController = new DatabaseController(this.databaseDescriptor);
	}

	/**
	 * Handle the request
	 */
	public async handle(
		request: Request,
	): Promise<[Response, PromiseLike<unknown>[]]> {
		const responseInit: ResponseInit = {
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Headers":
					"Origin, Authorization, Content-Type, X-BASELESS-CLIENT-ID",
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
		const client = await this.clientProvider?.getClientById(client_id);

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
			if (this.functionsHttpMap.has(fnName)) {
				try {
					const onCall = this.functionsHttpMap.get(fnName)!;
					const result = await onCall(request, context);
					const response = new Response(result.body, {
						...responseInit,
						headers: { ...responseInit.headers, ...result.headers },
					});
					return [response, waitUntilCollection];
				} catch (_err) {
					return [
						new Response(null, { ...responseInit, status: 500 }),
						waitUntilCollection,
					];
				}
			}
			return [
				new Response(null, { ...responseInit, status: 405 }),
				waitUntilCollection,
			];
		}

		let commands: Commands | undefined;
		switch (request.headers.get("Content-Type")?.toLocaleLowerCase()) {
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

				const result = validator.validate(commands);
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
		}

		// Request did not contain any valid commands
		if (!commands) {
			return [
				new Response(null, { ...responseInit, status: 400 }),
				waitUntilCollection,
			];
		}

		const promises: Promise<[string, Result]>[] = Object.entries(commands)
			.map(([key, cmd]) => {
				switch (cmd.cmd) {
					case "auth.create-anonymous-user":
						return this.authController.createAnonymousUser(request, context)
							.then(
								(res) => [key, res],
							);
					case "auth.add-sign-with-email-password":
						return this.authController.addSignWithEmailPassword(
							request,
							context,
							cmd.locale,
							cmd.email,
							cmd.password,
						).then((res) => [key, res]);
					case "auth.create-user-with-email-password":
						return this.authController.createUserWithEmail(
							request,
							context,
							cmd.locale,
							cmd.email,
							cmd.password,
						).then((res) => [key, res]);
					case "auth.send-email-validation-code":
						return this.authController.sendValidationEmail(
							request,
							context,
							cmd.locale,
							cmd.email,
						).then((res) => [key, res]);
					case "auth.validate-email":
						return this.authController.validateEmailWithCode(
							request,
							context,
							cmd.email,
							cmd.code,
						).then((res) => [key, res]);
					case "auth.send-password-reset-code":
						return this.authController.sendPasswordResetEmail(
							request,
							context,
							cmd.locale,
							cmd.email,
						).then((res) => [key, res]);
					case "auth.reset-password":
						return this.authController.resetPasswordWithCode(
							request,
							context,
							cmd.email,
							cmd.code,
							cmd.password,
						).then((res) => [key, res]);
					case "auth.sign-with-email-password":
						return this.authController.signWithEmailPassword(
							request,
							context,
							cmd.email,
							cmd.password,
						).then((res) => [key, res]);
					case "db.get":
						return this.databaseController.get(
							request,
							context,
							doc(cmd.ref),
						).then((res) => [key, res]);
					case "db.list":
						return this.databaseController.list(
							request,
							context,
							collection(cmd.ref),
							cmd.filter,
						).then((res) => [key, res]);
					case "db.create":
						return this.databaseController.create(
							request,
							context,
							doc(cmd.ref),
							cmd.metadata,
							cmd.data,
						).then((res) => [key, res]);
					case "db.update":
						return this.databaseController.update(
							request,
							context,
							doc(cmd.ref),
							cmd.metadata,
							cmd.data,
						).then((res) => [key, res]);
					case "db.delete":
						return this.databaseController.delete(
							request,
							context,
							doc(cmd.ref),
						).then((res) => [key, res]);
					default:
						return Promise.resolve([key, { error: "METHOD_NOT_ALLOWED" }]);
				}
			});

		const responses = await Promise.all(promises);
		const results = responses.reduce((results, [key, res]) => {
			results[key] = res;
			return results;
		}, {} as Results);

		return [
			new Response(JSON.stringify(results), { ...responseInit, status: 200 }),
			waitUntilCollection,
		];
	}
}
