import { Application } from "../../lib/application/application.ts";
import { DocumentConfiguration } from "./configuration.ts";
import type { DocumentContext } from "./context.ts";
import { DocumentService } from "./document.ts";

export { DocumentConfiguration } from "./configuration.ts";

export const document = (
	builder:
		| DocumentConfiguration
		| ((
			configuration: DocumentConfiguration,
		) => DocumentConfiguration),
) => {
	const configuration = builder instanceof DocumentConfiguration
		? builder.build()
		: builder(new DocumentConfiguration()).build();
	return new Application()
		.derive(() => {
			const context: DocumentContext = {
				document: new DocumentService(configuration.documentProvider),
			};
			return context;
		});
};

export default document;
