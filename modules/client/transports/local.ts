import { ITransport } from "./transport.ts";
import type { Server } from "https://baseless.dev/x/server/server.ts";
import { App } from "../app.ts";
import { Command, Result } from "https://baseless.dev/x/shared/server.ts";

export class LocalTransport implements ITransport {
	public constructor(
		public readonly server: Server,
	) {}

	send(app: App, command: Command): Promise<Result> {
		return this.server.handleCommand(app.getClientId(), app.getAuth()?.getTokens()?.access_token, command);
	}
}
