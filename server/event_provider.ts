import type { Static } from "@sinclair/typebox";
import type { EventDefinition, PickAtPath } from "./types.ts";
import type { ID } from "@baseless/core/id";

export abstract class EventProvider {
	abstract publish(key: string[], payload: unknown): Promise<void>;
	abstract subscribe(key: string[], hubId: ID<"hub_">): Promise<void>;
	abstract unsubscribe(key: string[], hubId: ID<"hub_">): Promise<void>;
	abstract unsubscribeAll(hubId: ID<"hub_">): Promise<void>;
}

export interface TypedEventProvider<TEvent extends EventDefinition<any, any>[]> extends EventProvider {
	publish<
		const TEventPath extends TEvent[number]["matcher"],
		const TEventDefinition extends PickAtPath<TEvent, TEventPath>,
	>(
		key: TEventPath,
		data: Static<TEventDefinition["payload"]>,
	): Promise<void>;
	subscribe<
		const TEventPath extends TEvent[number]["matcher"],
	>(key: TEventPath, hubId: ID<"hub_">): Promise<void>;
	unsubscribe<
		const TEventPath extends TEvent[number]["matcher"],
	>(key: TEventPath, hubId: ID<"hub_">): Promise<void>;
}
