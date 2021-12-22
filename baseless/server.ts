import {
	importPKCS8,
	importSPKI,
	jwtVerify,
	KeyLike,
} from "https://deno.land/x/jose@v4.3.7/index.ts";
import * as log from "https://deno.land/std@0.118.0/log/mod.ts";
import {
	AuthDescriptor,
	AuthIdentifier,
	AuthService,
	IAuthProvider,
	NoopAuthService,
} from "./core/auth.ts";
import { ClientsDescriptor } from "./core/clients.ts";
import {
	CachableDatabaseService,
	collection,
	DatabaseDescriptor,
	DatabaseService,
	doc,
	IDatabaseProvider,
	NoopDatabaseService,
} from "./core/database.ts";
import { FunctionsDescriptor } from "./core/functions.ts";
import {
	IKVProvider,
	KVScanFilter,
	KVService,
	NoopKVService,
} from "./core/kv.ts";
import {
	IMailProvider,
	MailDescriptor,
	MailService,
	NoopMailService,
} from "./core/mail.ts";
import { IContext } from "./core/context.ts";
import { Commands, Result, Results, validator } from "./server/schema.ts";
import createAuthController from "./server/auth.ts";
import createDatabaseController from "./server/database.ts";

export async function importKeys(
	alg: string,
	publicKey: string,
	privateKey: string,
): Promise<[KeyLike, KeyLike]> {
	return [
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

// deno-lint-ignore require-await
export async function createOBaseHandler({
	clientsDescriptor,
	authDescriptor,
	databaseDescriptor,
	functionsDescriptor,
	mailDescriptor,
	authProvider,
	kvProvider,
	databaseProvider,
	mailProvider,
	algKey,
	publicKey,
	privateKey,
}: {
	clientsDescriptor: ClientsDescriptor;
	authDescriptor: AuthDescriptor;
	databaseDescriptor: DatabaseDescriptor;
	functionsDescriptor: FunctionsDescriptor;
	mailDescriptor: MailDescriptor;
	authProvider?: IAuthProvider;
	kvProvider?: IKVProvider;
	databaseProvider?: IDatabaseProvider;
	mailProvider?: IMailProvider;
	algKey: string;
	publicKey: KeyLike;
	privateKey: KeyLike;
}): Promise<(req: Request) => Promise<[Response, PromiseLike<unknown>[]]>> {
	const logger = log.getLogger("baseless_server");

	const authService = authProvider
		? new AuthService(authProvider)
		: new NoopAuthService();
	const kvService = kvProvider
		? new KVService(kvProvider)
		: new NoopKVService();
	const databaseService = databaseProvider
		? new DatabaseService(databaseProvider)
		: new NoopDatabaseService();
	const mailService = mailProvider
		? new MailService(mailDescriptor, mailProvider)
		: new NoopMailService();
	const functionsMap = new Map(
		functionsDescriptor.https.filter((http) => http.onCall).map(
			(http) => [http.path, http.onCall!],
		),
	);

	const authController = await createAuthController({
		logger,
		authDescriptor,
		algKey,
		publicKey,
		privateKey,
	});
	const databaseController = await createDatabaseController({
		logger,
		databaseDescriptor,
	});

	return async (request: Request) => {
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
			database: databaseService,
			mail: mailService,
		};

		const url = new URL(request.url);
		const segments = url.pathname.replace(/(^\/|\/$)/, "").split("/");
		switch (segments[0]) {
			case "1.0": {
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

				logger.debug(commands);
				// TODO: Descriptor's security
				const results: Results = {};
				await Promise.all(
					Object.entries(commands).map(([key, cmd]) => {
						let p: Promise<Result>;
						switch (cmd.cmd) {
							case "fn.call":
								if (functionsMap.has(cmd.ref)) {
									const onCall = functionsMap.get(cmd.ref)!;
									p = onCall(context, request).then((res) => res.text()).then(
										(ret) => ({ ret }),
									);
								} else {
									p = Promise.resolve({ error: "METHOD_NOT_ALLOWED" });
								}
								break;
							case "db.get":
								p = databaseController.get(request, context, doc(cmd.ref));
								break;
							case "db.list":
								p = databaseController.list(
									request,
									context,
									collection(cmd.ref),
									cmd.filter,
								);
								break;
							case "db.create":
								p = databaseController.create(
									request,
									context,
									doc(cmd.ref),
									cmd.metadata,
									cmd.data,
								);
								break;
							case "db.update":
								p = databaseController.update(
									request,
									context,
									doc(cmd.ref),
									cmd.metadata,
									cmd.data,
								);
								break;
							case "db.delete":
								p = databaseController.delete(request, context, doc(cmd.ref));
								break;
							case "auth.create-anonymous-user":
								p = authController.createAnonymousUser(request, context);
								break;
							case "auth.add-sign-with-email-password":
								p = authController.addSignWithEmailPassword(
									request,
									context,
									cmd.locale,
									cmd.email,
									cmd.password,
								);
								break;
							case "auth.create-user-with-email-password":
								p = authController.createUserWithEmail(
									request,
									context,
									cmd.locale,
									cmd.email,
									cmd.password,
								);
								break;
							case "auth.sign-with-email-password":
								p = authController.signWithEmailPassword(
									request,
									context,
									cmd.email,
									cmd.password,
								);
								break;
							case "auth.send-email-validation-code":
								p = authController.sendVerificationEmail(
									request,
									context,
									cmd.locale,
								);
								break;
							case "auth.validate-email":
								p = authController.validateEmailWithCode(
									request,
									context,
									cmd.email,
									cmd.code,
								);
								break;
							case "auth.send-password-reset-code":
								p = authController.sendPasswordResetEmail(
									request,
									context,
									cmd.locale,
									cmd.email,
								);
								break;
							case "auth.reset-password":
								p = authController.resetPasswordWithCode(
									request,
									context,
									cmd.email,
									cmd.code,
									cmd.password,
								);
								break;
							default:
								p = Promise.reject("CommandNotAllowed");
								break;
						}
						return p
							.catch((err) => ({ error: err.toString() }))
							.then((res) => {
								results[key] = res;
							});
					}),
				);

				return [
					new Response(JSON.stringify(results), { status: 200 }),
					waitUntilCollection,
				];
			}
			default: {
				return [new Response(null, { status: 405 }), waitUntilCollection];
			}
		}

		return [new Response(null, { status: 500 }), []];
	};
}
