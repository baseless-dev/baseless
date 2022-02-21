import { ITransport } from "./transport.ts";
import { IBatchableTransport } from "./batch.ts";
import { App } from "../app.ts";
import { Command, Result, UnknownError } from "https://baseless.dev/x/shared/server.ts";
import { Deferred } from "../utils.ts";

export class FetchTransport implements ITransport, IBatchableTransport {
	public constructor(
		public readonly baselessUrl: string,
	) {}

	async send(app: App, command: Command): Promise<Result> {
		const deferred = new Deferred<Result>();
		this.sendBatch(app, [[command, deferred]]);
		return await deferred.promise;
	}

	async sendBatch(app: App, commands: [Command, Deferred<Result>][]): Promise<void> {
		const tokens = app.getAuth()?.getTokens();
		const body = Object.fromEntries(commands.map((c) => c[0]).entries());
		const request = new Request(this.baselessUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-BASELESS-CLIENT-ID": app.getClientId(),
				...(tokens?.access_token ? { "Authorization": `Bearer ${tokens.access_token}` } : {}),
			},
			body: JSON.stringify(body),
		});
		const response = await fetch(request);
		const results = await response.json();
		for (let i = 0, l = commands.length; i < l; ++i) {
			if (i in results) {
				commands[i][1].resolve(results[i]);
			} else {
				commands[i][1].reject(new UnknownError());
			}
		}
	}
}
