import { app, Permission } from "../app.ts";
import * as z from "@baseless/core/schema";
import { first } from "@baseless/core/iter";
import { ForbiddenError, TopicNotFoundError } from "@baseless/core/errors";
import { Response } from "@baseless/core/response";

const pubsubApp = app()
	.endpoint({
		path: "core/pubsub/publish",
		request: z.jsonRequest({
			key: z.string(),
			payload: z.unknown(),
		}),
		response: z.jsonResponse({
			sent: z.boolean(),
		}),
		handler: async ({ app, auth, configuration, context, service, signal, request, waitUntil }) => {
			const { key, payload } = request.body;
			try {
				// deno-lint-ignore no-var no-inner-declarations
				var [params, definition] = first(app.match("topic", key));
			} catch (cause) {
				throw new TopicNotFoundError(undefined, { cause });
			}

			if ("security" in definition) {
				const permission = await definition.security({
					app,
					auth,
					configuration,
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

			await service.pubsub.publish(key as never, payload as never, signal);

			return Response.json({ sent: true });
		},
	});

export default pubsubApp;

export type PubsubApplication = ReturnType<typeof pubsubApp.build>;
