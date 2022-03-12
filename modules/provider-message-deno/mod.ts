import { logger } from "https://baseless.dev/x/logger/mod.ts";
import type {
	IChannel,
	IMessageHub,
	IMessageProvider,
	IParticipant,
	ISession,
} from "https://baseless.dev/x/provider/message.ts";
import { ChannelPermissions, MessageDescriptor } from "https://baseless.dev/x/worker/message.ts";
import type { Context } from "https://baseless.dev/x/provider/context.ts";
import { autoid } from "https://baseless.dev/x/shared/autoid.ts";
import type { MessagePayload } from "https://baseless.dev/x/shared/server.ts";
import { messageValidator } from "https://baseless.dev/x/shared/schema.ts";
import { channel, ChannelReference } from "https://baseless.dev/x/shared/message.ts";
import type { ChannelMessage } from "https://baseless.dev/x/shared/message.ts";

export class DenoMessageHub implements IMessageHub {
	private logger = logger("DenoMessageHub");
	private sessions = new Set<ISession>();
	private channels = new Map<string, IChannel>();

	public constructor(
		private messageDescriptor: MessageDescriptor,
	) {}

	// deno-lint-ignore require-await
	async transfert(request: Request, context: Context): Promise<Response> {
		const { response, socket } = Deno.upgradeWebSocket(request);

		const session: ISession = {
			id: autoid(),
			userId: context.currentUserId,
			socket,
		};

		socket.onopen = () => {
			this.logger.debug(`Session ${session.id} connected.`);
			this.sessions.add(session);
			session.socket.send(JSON.stringify({ sessionId: session.id }));
		};

		socket.onclose = async () => {
			this.logger.debug(`Session ${session.id} disconnected.`);
			for (const [ref, chan] of this.channels.entries()) {
				const idx = chan.participants.findIndex((participant) => participant.sessionId === session.id);
				if (idx > 0) {
					const participant = chan.participants.splice(idx, 1)[0];
					const [desc, params] = this.messageDescriptor.getChannelDescriptor(ref) ?? [];
					if (desc && params) {
						await desc.onLeave(context, chan, participant, params);
					}
				}
			}
			this.sessions.delete(session);
		};

		socket.onmessage = async ({ data }) => {
			this.logger.debug(`Session ${session.id} sent message.`);
			try {
				const payload: MessagePayload = JSON.parse(data.toString());
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
								let chan: IChannel;
								if (!this.channels.has(payload.ref)) {
									chan = {
										ref: channel(payload.ref),
										metadata: {},
										participants: [],
									};
									this.channels.set(payload.ref, chan);
									await desc.onCreate(context, chan, params);
								} else {
									chan = this.channels.get(payload.ref)!;
								}
								// TODO is sessionId already present in channel?
								const participant: IParticipant = {
									metadata: {},
									sessionId: session.id,
									userId: session.userId,
									send(message) {
										session.socket.send(JSON.stringify({ channel: payload.ref, message }));
									},
								};
								chan.participants.push(participant);

								await desc.onJoin(context, chan, participant, params);

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
						const [desc, params] = this.messageDescriptor.getChannelDescriptor(payload.ref) ?? [];
						if (desc && params) {
							const chan = this.channels.get(payload.ref);
							if (chan) {
								const idx = chan.participants.findIndex((participant) => participant.sessionId === session.id);

								// Participant is in channel?
								if (idx > 0) {
									const participant = chan.participants.splice(idx, 1)[0];
									await desc.onLeave(context, chan, participant, params);

									session.socket.send(JSON.stringify({ id: payload.id }));
									return;
								}
							}
						}

						session.socket.send(JSON.stringify({ id: payload.id, error: "ChannelNotFoundError" }));
						return;
					} else if (payload.type === "chan.send") {
						const [desc, params] = this.messageDescriptor.getChannelDescriptor(payload.ref) ?? [];
						if (desc && params) {
							const permission = await desc.permission(context, params);

							// Can send channel
							if ((permission & ChannelPermissions.Send) > 0) {
								const chan = this.channels.get(payload.ref);
								if (chan) {
									const participant = chan.participants.find((participant) => participant.sessionId === session.id);

									// Participant is in channel?
									if (participant) {
										session.socket.send(JSON.stringify({ id: payload.id }));

										await desc.onMessage(context, chan, participant, payload.message, params);
										return;
									}
								}
							} else {
								session.socket.send(JSON.stringify({ id: payload.id, error: "ChannelPermissionRequired" }));
								return;
							}
						}

						session.socket.send(JSON.stringify({ id: payload.id, error: "ChannelNotFoundError" }));
						return;
					}
				}
			} catch (err) {
				this.logger.error(`Session ${session.id}, could not parse message, got ${err}.`);
			}
		};

		return response ?? new Response(null, { status: 500 });
	}

	async broadcast(context: Context, reference: ChannelReference, message: ChannelMessage): Promise<void> {
		const ref = reference.toString();
		this.logger.debug(`System broadcast to ${ref}.`);
		const chan = this.channels.get(ref);
		const [desc, params] = this.messageDescriptor.getChannelDescriptor(ref) ?? [];
		if (chan && desc && params) {
			await desc.onMessage(context, chan, undefined, message, params);
		}
	}
}

export class DenoMessageProvider implements IMessageProvider {
	public constructor(private messageHub: DenoMessageHub) {}

	broadcast(context: Context, reference: ChannelReference, message: ChannelMessage): Promise<void> {
		return this.messageHub.broadcast(context, reference, message);
	}
}
