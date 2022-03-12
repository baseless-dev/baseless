import { UnknownError } from "https://baseless.dev/x/shared/server.ts";
import {
	ChannelMessage,
	ChannelNotFoundError,
	ChannelPermissionRequired,
	ChannelReference,
	MessageSendError,
} from "https://baseless.dev/x/shared/message.ts";
import { App } from "./app.ts";
import { Deferred, EventEmitter } from "./utils.ts";

type MessageType =
	| { type: "onopen" }
	| { type: "onclose"; reason: string }
	| { type: "onerror"; error: string }
	| { type: "onmessage"; data: string };

export class Message {
	/**
	 * Construct an `Auth` object
	 * @internal
	 */
	public constructor(
		public readonly app: App,
		public readonly endpoint: string,
	) {
		this._emitter = new EventEmitter();
	}

	private _socket: WebSocket | undefined;
	private _sessionId: string | undefined;
	private _emitter: EventEmitter<[MessageType]>;

	private _nextId = 1;

	public getNextId() {
		return (this._nextId++).toString();
	}

	/**
	 * Close underlying WebSocket
	 */
	public close() {
		if (this._socket) {
			this._socket.close();
			this._socket = undefined;
		}
	}

	/**
	 * Retrieve ot initialize new WebSocket
	 *
	 * @internal
	 */
	private _getWebSocket(): WebSocket {
		// No previous websocket or closing or closed
		if (
			!this._socket ||
			this._socket.readyState === WebSocket.CLOSING ||
			this._socket.readyState === WebSocket.CLOSED
		) {
			// Create new WebSocket and store it
			const client_id = this.app.getClientId();
			const tokens = this.app.getAuth()?.getTokens();
			const endpoint = this.endpoint;
			this._socket?.close();
			this._socket = new WebSocket(`${endpoint}?client_id=${client_id}&access_token=${tokens?.access_token}`);
			this._socket.onopen = () => this._emitter.emit({ type: "onopen" });
			this._socket.onclose = ({ reason }) => this._emitter.emit({ type: "onclose", reason });
			this._socket.onerror = (e) => this._emitter.emit({ type: "onerror", error: "message" in e ? e.message : e.type });
			this._socket.onmessage = ({ data }) => this._emitter.emit({ type: "onmessage", data });
		}
		return this._socket;
	}

	/**
	 * Wait till socket is of state
	 * @internal
	 */
	public _onOpen(timeout?: number): Promise<WebSocket> {
		timeout = timeout ?? 10_000;
		const conn = this._getWebSocket();
		if (conn.readyState === WebSocket.OPEN) {
			return Promise.resolve(conn);
		}

		const defer = new Deferred<WebSocket>();

		const dispose = this._emitter.listen((msg) => {
			if (msg.type === "onmessage") {
				const data = JSON.parse(msg.data);
				if ("sessionId" in data) {
					this._sessionId = data.sessionId;

					dispose();
					clearTimeout(timer);
					defer.resolve(conn);
				}
			}
		});

		const timer = setTimeout(() => {
			dispose();
			defer.reject();
		}, timeout);

		return defer.promise;
	}

	/**
	 * Send message
	 *
	 * @internal
	 */
	public async _send(message: ChannelMessage, options?: { expect: ChannelMessage; timeout?: number }): Promise<void> {
		const timeout = options?.timeout ?? 10_000;
		const conn = await this._onOpen(timeout);
		if (options?.expect) {
			const defer = new Deferred<void>();

			const dispose = this._emitter.listen((msg) => {
				if (msg.type === "onmessage" && msg.data === options.expect) {
					clearTimeout(timer);
					defer.resolve();
				}
			});

			const timer = setTimeout(() => {
				dispose();
				defer.reject();
			}, timeout);

			conn.send(message);

			return defer.promise;
		} else {
			conn.send(message);
		}
	}

	/**
	 * Add listener
	 */
	public _listen(handler: (message: MessageType) => void) {
		return this._emitter.listen(handler);
	}
}

const errorMap = new Map<string, new () => Error>([
	["UnknownError", UnknownError],
	["ChannelNotFoundError", ChannelNotFoundError],
	["ChannelPermissionRequired", ChannelPermissionRequired],
	["MessageSendError", MessageSendError],
]);

function messageErrorCodeToError(errorCode: string): Error | undefined {
	if (errorMap.has(errorCode)) {
		const error = errorMap.get(errorCode)!;
		return new error();
	}
}

/**
 * Returns the Message instance associated with the provided `BaselessApp`.
 */
export function getMessage(app: App, endpoint: string) {
	const db = new Message(app, endpoint);
	return db;
}

export type JoinResult = {
	leave: () => Promise<void>;
	publish: (message: ChannelMessage) => Promise<void>;
};

export type MessageEvent =
	| { type: "close" }
	| { type: "error" }
	| { type: "message"; data: ChannelMessage };

/**
 * Join a channel and
 */
export async function join(
	message: Message,
	reference: ChannelReference,
	handler: (message: MessageEvent) => void,
	timeout?: number,
): Promise<JoinResult> {
	const id = message.getNextId();
	const ref = reference.toString();
	try {
		await message._send(JSON.stringify({ id, type: "chan.join", ref }), { expect: JSON.stringify({ id }), timeout });
		const disposeOnMessage = message._listen((msg) => {
			if (msg.type === "onclose") {
				handler({ type: "close" });
			} else if (msg.type === "onerror") {
				handler({ type: "error" });
			} else if (msg.type === "onmessage") {
				const data = JSON.parse(msg.data);
				if ("channel" in data && data.channel === ref) {
					handler({ type: "message", data: data.message });
				}
			}
		});
		return {
			// deno-lint-ignore require-await
			async leave() {
				disposeOnMessage();
			},
			async publish(msg: ChannelMessage) {
				const id = message.getNextId();
				await message._send(JSON.stringify({ id, type: "chan.send", ref, message: msg }));
			},
		};
	} catch (_err) {
		// TODO messageErrorCodeToError
		debugger;
		throw new Error("JOIN ERROR");
	}
}
