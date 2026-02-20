import { app, Permission, Type } from "@baseless/server";
import { authentication, document, openapi } from "@baseless/server/apps";
import { Output } from "@baseless/core/output";

export default app()
	// .extend(authentication)
	.extend(document)
	.extend(openapi)
	.endpoint({
		path: "hello",
		input: Type.Input({
			method: "POST",
			searchParams: { world: Type.String() },
		}),
		output: Type.Output({
			status: 200,
			body: Type.String(),
		}),
		security: () => Permission.Fetch,
		handler: ({ input }) => {
			return new Output(`Hello ${input}`);
		},
	})
	.collection({
		path: "posts",
		schema: Type.Object({
			title: Type.String(),
			content: Type.String(),
		}),
		collectionSecurity: () => Permission.All,
		documentSecurity: () => Permission.All,
	})
	.document({
		path: "features",
		schema: Type.Object({
			showCookieBanner: Type.Boolean(),
			ignoreCookieConsent: Type.Boolean(),
		}),
		documentSecurity: () => Permission.All,
	});
