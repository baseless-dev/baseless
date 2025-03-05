import { onRequest, Permission, TDefinition, TTopic } from "../app.ts";
import * as Type from "@baseless/core/schema";
import type { Matcher } from "@baseless/core/path";
import { first } from "@baseless/core/iter";

export default function createPubSubApplication(
	topicMatcher: Matcher<TTopic<any, Type.TSchema>>,
): TDefinition[] {
	return [
		onRequest(
			"pubsub/publish",
			Type.Object({
				key: Type.String(),
				payload: Type.Unknown(),
			}, ["key", "payload"]),
			Type.Void(),
			async ({ auth, context, service, signal, input, waitUntil }) => {
				try {
					// deno-lint-ignore no-var no-inner-declarations
					var [params, definition] = first(topicMatcher(input.key));
				} catch (_error) {
					throw "NOT_FOUND";
				}

				if (definition.security) {
					const permission = await definition.security({
						auth,
						context,
						params,
						service,
						signal,
						waitUntil,
					});
					if ((permission & Permission.Publish) == 0) {
						throw "FORBIDDEN";
					}
				}

				await service.pubsub.publish(input.key, input.payload, signal);
				return;
			},
			() => Permission.All,
		),
	];
}
