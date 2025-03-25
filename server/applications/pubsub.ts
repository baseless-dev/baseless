import { onRequest, Permission, type TDefinition, type TTopic } from "../app.ts";
import * as Type from "@baseless/core/schema";
import type { Matcher } from "@baseless/core/path";
import { first } from "@baseless/core/iter";
import { ForbiddenError, TopicNotFoundError } from "@baseless/core/errors";

export default function createPubSubApplication(
	topicMatcher: Matcher<TTopic<string, Type.TSchema>>,
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
				} catch (cause) {
					throw new TopicNotFoundError(undefined, { cause });
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
						throw ForbiddenError;
					}
				}

				await service.pubsub.publish(input.key, input.payload, signal);
				return;
			},
			() => Permission.All,
		),
	];
}
