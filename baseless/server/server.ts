import {
	importPKCS8,
	importSPKI,
	jwtVerify,
	KeyLike,
} from "https://deno.land/x/jose@v4.3.7/index.ts";
import { getLogger, Logger } from "https://deno.land/std@0.118.0/log/mod.ts";
import {
	AuthDescriptor,
	AuthIdentifier,
	AuthService,
	IAuthProvider,
	IAuthService,
	NoopAuthService,
} from "../core/auth.ts";
import { ClientsDescriptor } from "../core/clients.ts";
import {
	CachableDatabaseService,
	collection,
	DatabaseDescriptor,
	DatabaseService,
	doc,
	IDatabaseProvider,
	IDatabaseService,
	NoopDatabaseService,
} from "../core/database.ts";
import {
	FunctionsDescriptor,
	FunctionsHttpHandler,
} from "../core/functions.ts";
import {
	IKVProvider,
	IKVService,
	KVService,
	NoopKVService,
} from "../core/kv.ts";
import {
	IMailProvider,
	IMailService,
	MailDescriptor,
	MailService,
	NoopMailService,
} from "../core/mail.ts";
import { auth, clients, database, functions, mail } from "../worker/mod.ts";
import { IContext } from "../core/context.ts";
import { Commands, Result, Results, validator } from "./schema.ts";
import { AuthController } from "./auth.ts";
import { DatabaseController } from "./database.ts";

export async function importKeys(
	alg: string,
	publicKey: string,
	privateKey: string,
): Promise<[string, KeyLike, KeyLike]> {
	return [
		alg,
		await importSPKI(
			publicKey,
			alg,
		),
		await importPKCS8(
			privateKey,
			alg,
		),
	];
}

export type ServerInit = {
	authProvider?: IAuthProvider;
	kvProvider?: IKVProvider;
	databaseProvider?: IDatabaseProvider;
	mailProvider?: IMailProvider;
	algKey: string;
	publicKey: KeyLike;
	privateKey: KeyLike;
};

export type ServerData = ServerInit & {
	clientsDescriptor: ClientsDescriptor;
	authDescriptor: AuthDescriptor;
	databaseDescriptor: DatabaseDescriptor;
	functionsDescriptor: FunctionsDescriptor;
	mailDescriptor: MailDescriptor;
	authService: IAuthService;
	kvService: IKVService;
	databaseService: IDatabaseService;
	mailService: IMailService;
	functionsMap: Map<string, FunctionsHttpHandler>;
	logger: Logger;
};

export class Server {
	private data: ServerData;
	private authController: AuthController;
	private databaseController: DatabaseController;

	public constructor(init: ServerInit) {
		const clientsDescriptor = clients.build();
		const authDescriptor = auth.build();
		const databaseDescriptor = database.build();
		const functionsDescriptor = functions.build();
		const mailDescriptor = mail.build();
		this.data = {
			...init,
			clientsDescriptor,
			authDescriptor,
			databaseDescriptor,
			functionsDescriptor,
			mailDescriptor,
			authService: init.authProvider
				? new AuthService(init.authProvider)
				: new NoopAuthService(),
			kvService: init.kvProvider ? new KVService(init.kvProvider)
			: new NoopKVService(),
			databaseService: init.databaseProvider
				? new DatabaseService(init.databaseProvider)
				: new NoopDatabaseService(),
			mailService: init.mailProvider
				? new MailService(mailDescriptor, init.mailProvider)
				: new NoopMailService(),
			functionsMap: new Map(
				functionsDescriptor.https.filter((http) => http.onCall).map(
					(http) => [http.path, http.onCall!],
				),
			),
			logger: getLogger("baseless_server"),
		};

		this.authController = new AuthController(this.data);
		this.databaseController = new DatabaseController(this.data);
	}

	/**
	 * Handle the request
	 */
	public async handle(
		request: Request,
	): Promise<[Response, PromiseLike<unknown>[]]> {
		const {
			logger,
			clientsDescriptor,
			databaseService,
			publicKey,
			authService,
			kvService,
			mailService,
		} = this.data;

		// Request must include a clientid in it's header
		if (!request.headers.has("X-BASELESS-CLIENT-ID")) {
			return [new Response(null, { status: 401 }), []];
		}

		const client_id = request.headers.get("X-BASELESS-CLIENT-ID") ?? "";
		const client = clientsDescriptor.find((c) => c.id === client_id);

		// Clientid must match a registered client
		if (!client) {
			return [new Response(null, { status: 401 }), []];
		}

		const dbService = new CachableDatabaseService(databaseService);
		let currentUserId: AuthIdentifier | undefined;

		if (request.headers.get("Authorization")) {
			const authorization = request.headers.get("Authorization") ?? "";
			const match = authorization.match(/(?<scheme>[^ ]+) (?<params>.+)/);
			if (match) {
				const scheme = match.groups?.scheme.toLowerCase() ?? "";
				const params = match.groups?.params ?? "";
				if (scheme === "bearer") {
					try {
						const { payload } = await jwtVerify(params, publicKey, {
							issuer: client.principal,
							audience: client.principal,
						});
						currentUserId = payload.sub ?? "";
					} catch (err) {
						logger.error(
							`Could not parse Authorization header, got error : ${err}`,
						);
					}
				}
			}
		}

		const waitUntilCollection: PromiseLike<unknown>[] = [];

		const context: IContext = {
			client,
			currentUserId,
			auth: authService,
			kv: kvService,
			database: dbService,
			mail: mailService,
			waitUntil(promise) {
				waitUntilCollection.push(promise);
			},
		};

		let commands: Commands | undefined;

		const url = new URL(request.url);

		logger.info(`${request.method} ${url.pathname}`);

		if (url.pathname.length > 1) {
			const fnName = url.pathname.substring(1);
			if (this.data.functionsMap.has(fnName)) {
				try {
					const onCall = this.data.functionsMap.get(fnName)!;
					const response = await onCall(request, context);
					return [response, waitUntilCollection];
				} catch (_err) {
					return [new Response(null, { status: 500 }), waitUntilCollection];
				}
			}
			return [new Response(null, { status: 405 }), waitUntilCollection];
		}

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
					logger.error(`Could not parse JSON body, got error : ${err}`);
					return [new Response(null, { status: 400 }), waitUntilCollection];
				}

				const result = validator.validate(commands);
				if (!result.valid) {
					logger.error(
						`JSON body did not validate againts schema, got error : ${result.errors}`,
					);
					// TODO if production?
					return [
						new Response(JSON.stringify(result.errors), { status: 400 }),
						waitUntilCollection,
					];
				}

				break;
			}
		}

		if (!commands) {
			return [
				new Response(null, { status: 400 }),
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
			new Response(JSON.stringify(results), { status: 200 }),
			waitUntilCollection,
		];
	}
}
