import { Command, Result, UnknownError } from "https://baseless.dev/x/shared/server.ts";
import { App } from "../app.ts";
import { Deferred } from "../utils.ts";
import { ITransport } from "./transport.ts";

export interface IBatchableTransport {
	sendBatch(app: App, commands: [Command, Deferred<Result>][]): Promise<void>;
}

export class BatchTransport implements ITransport {
	public constructor(
		protected readonly _batchTransport: IBatchableTransport,
		protected readonly _batchSize = 10,
	) {}

	protected _batchBuckets = new Map<App, { timer: number; commands: Array<[Command, Deferred<Result>]> }>();

	send(app: App, command: Command): Promise<Result> {
		const deferred = new Deferred<Result>();

		if (!this._batchBuckets.has(app)) {
			this._batchBuckets.set(app, { timer: 0, commands: [] });
		}
		const bucket = this._batchBuckets.get(app)!;
		bucket.commands.push([command, deferred]);
		if (!bucket.timer) {
			bucket.timer = setTimeout(async () => {
				while (bucket.commands.length) {
					const commands = bucket.commands.splice(0, this._batchSize);
					try {
						await this._batchTransport.sendBatch(app, commands);
					} catch (_err) {
						for (const [, deferred] of commands) {
							deferred.reject(new UnknownError());
						}
					}
				}
				bucket.timer = 0;
			}, 0);
		}

		return deferred.promise;
	}
}
