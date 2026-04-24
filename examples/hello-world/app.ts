import { app, Permission } from "@baseless/server";
import docApp from "@baseless/server/apps/document";
import openapiApp from "@baseless/server/apps/openapi";
import * as z from "@baseless/core/schema";
import { Response } from "@baseless/core/response";

export default app()
	.extend(docApp)
	.extend(openapiApp)
	.endpoint({
		path: "hello",
		request: z.request(),
		response: z.textResponse(),
		handler: () => {
			return Response.text("Hello World");
		},
	})
	.collection({
		path: "posts",
		schema: z.object({
			title: z.string(),
			content: z.string(),
		}),
		collectionSecurity: () => Permission.All,
		documentSecurity: () => Permission.All,
		topicSecurity: () => Permission.All,
	})
	.document({
		path: "features",
		schema: z.object({
			showCookieBanner: z.boolean(),
			ignoreCookieConsent: z.boolean(),
		}),
		documentSecurity: () => Permission.All,
		topicSecurity: () => Permission.All,
	});
