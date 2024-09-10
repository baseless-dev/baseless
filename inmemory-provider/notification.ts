import type { NotificationProvider } from "@baseless/server/notification-provider";
import type { Identity } from "@baseless/core/identity";
import type { Notification, NotificationTransport } from "@baseless/core/notification";

export class MemoryNotificationProvider implements NotificationProvider {
	#storage: Map<
		Identity["identityId"],
		Record<NotificationTransport["kind"], NotificationTransport>
	> = new Map();
	notifications: Map<Identity["identityId"], Notification[]> = new Map();

	getNotificationTransports(
		identityId: Identity["identityId"],
		transportKind: NotificationTransport["kind"],
	): Promise<NotificationTransport> {
		const transports = this.#storage.get(identityId);
		if (!transports || !(transportKind in transports)) {
			throw new Error("Transport not found");
		}
		return Promise.resolve(transports[transportKind]);
	}
	addTransportToIdentity(
		identityId: Identity["identityId"],
		transport: NotificationTransport,
	): Promise<boolean> {
		const transports = this.#storage.get(identityId) || {};
		transports[transport.kind] = transport;
		this.#storage.set(identityId, transports);
		return Promise.resolve(true);
	}

	listTransportsForIdentity(
		identityId: Identity["identityId"],
	): Promise<NotificationTransport[]> {
		const transports = this.#storage.get(identityId);
		if (!transports) {
			return Promise.resolve([]);
		}
		return Promise.resolve(Object.values(transports));
	}
	removeTransportFromIdentity(
		identityId: Identity["identityId"],
		transportKind: NotificationTransport["kind"],
	): Promise<boolean> {
		const transports = this.#storage.get(identityId);
		if (!transports || !(transportKind in transports)) {
			return Promise.resolve(false);
		}
		delete transports[transportKind];
		return Promise.resolve(true);
	}
	sendNotification(
		identityId: Identity["identityId"],
		notification: Notification,
	): Promise<boolean> {
		this.notifications.set(identityId, [
			...(this.notifications.get(identityId) || []),
			notification,
		]);
		return Promise.resolve(true);
	}
}
