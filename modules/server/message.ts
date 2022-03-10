import { logger } from "https://baseless.dev/x/logger/mod.ts";
import { ChannelPermissions, MessagePermissions } from "https://baseless.dev/x/worker/message.ts";
import type { MessageDescriptor } from "https://baseless.dev/x/worker/message.ts";
import type { Context } from "https://baseless.dev/x/provider/context.ts";
import type { IMessageProvider, ISession } from "https://baseless.dev/x/provider/message.ts";
import { autoid } from "https://baseless.dev/x/shared/autoid.ts";
import { messageValidator } from "./schema.ts";
import type { MessagePayload } from "https://baseless.dev/x/shared/server.ts";
import { channel } from "https://baseless.dev/x/shared/message.ts";

export class MessageController {
	protected logger = logger("server/MessageController");

	public constructor(
		private messageDescriptor: MessageDescriptor,
		private messageProvider: IMessageProvider,
	) {}

	public async accept(
		request: Request,
		context: Context,
		upgrader: (request: Request) => Promise<[Response, WebSocket | null]>,
	): Promise<[Response, PromiseLike<unknown>[]]> {
		const permission = await this.messageDescriptor.permission(context);

		// Does not have connect permission
		if ((permission & MessagePermissions.Connect) === 0) {
			return [
				new Response(null, { status: 401 }),
				[],
			];
		}

		try {
			const [response, socket] = await upgrader(request);

			if (socket) {
				const session: ISession = {
					id: autoid(),
					userId: context.currentUserId,
					socket,
				};
				socket.onopen = async (_event) => {
					await this.messageProvider.connect(context, session);
				};
				socket.onclose = async (_event) => {
					await this.messageProvider.disconnect(context, session);
				};
				socket.onerror = (event) => {
					this.logger.warn(`Session ${session.id} got error : ${event}.`);
				};
				socket.onmessage = async (event) => {
					try {
						const payload: MessagePayload = JSON.parse(event.data.toString());
						const result = messageValidator.validate(payload);
						if (!result.valid) {
							this.logger.error(`Session ${session.id}, malformed payload : ${JSON.stringify(result.errors)}`);
						} else {
							if (payload.type === "chan.join") {
								const [desc, params] = this.messageDescriptor.getChannelDescriptor(payload.ref) ?? [];
								if (desc && params) {
									const permission = await desc.permission(context, params);

									// Can join channel
									if ((permission & ChannelPermissions.Join) > 0) {
										const ref = channel(payload.ref);
										await this.messageProvider.join(context, session, ref);
										session.socket.send(JSON.stringify({ id: payload.id }));
										return;
									} else {
										session.socket.send(JSON.stringify({ id: payload.id, error: "ChannelPermissionRequired" }));
										return;
									}
								}

								session.socket.send(JSON.stringify({ id: payload.id, error: "ChannelNotFoundError" }));
								return;
							} else if (payload.type === "chan.leave") {
								const result = this.messageDescriptor.getChannelDescriptor(payload.ref);
								if (result) {
									const ref = channel(payload.ref);
									await this.messageProvider.leave(context, session, ref);
									session.socket.send(JSON.stringify({ id: payload.id }));
								}

								session.socket.send(JSON.stringify({ id: payload.id, error: "MessageSendError" }));
								return;
							} else if (payload.type === "chan.send") {
								const [desc, params] = this.messageDescriptor.getChannelDescriptor(payload.ref) ?? [];
								if (desc && params) {
									const permission = await desc.permission(context, params);

									// Can join channel
									if ((permission & ChannelPermissions.Send) > 0) {
										const ref = channel(payload.ref);
										session.socket.send(JSON.stringify({ id: payload.id }));
										await this.messageProvider.send(context, session, ref, payload.message);
										return;
									} else {
										session.socket.send(JSON.stringify({ id: payload.id, error: "ChannelPermissionRequired" }));
										return;
									}
								}

								session.socket.send(JSON.stringify({ id: payload.id, error: "ChannelNotFoundError" }));
								return;
							}
							console.log(session.id, payload);
						}
					} catch (err) {
						this.logger.error(`Session ${session.id}, could not parse message, got ${err}.`);
					}
				};
			}

			return [response, []];
		} catch (err) {
			this.logger.error(`Could not upgrade request to WebSocket, got ${err}`);
			return [
				new Response(null, { status: 500 }),
				[],
			];
		}
	}
}
