import { Helmet, renderSSR } from "https://deno.land/x/nano_jsx@v0.0.32/mod.ts";
// Doesn't work with `deno bundle`
// import { setup } from "https://esm.sh/v94/twind@0.16.17/";
// import type { TW } from "https://esm.sh/v94/twind@0.16.17/";
// import { getStyleTag, shim, virtualSheet } from "https://esm.sh/v94/twind@0.16.17/shim/server";
// import type { VirtualSheet } from "https://esm.sh/v94/twind@0.16.17/shim/server";
import { setup } from "https://esm.sh/v94/twind@0.16.17/deno/twind.js";
import type { TW } from "https://esm.sh/v94/twind@0.16.17/twind.d.ts";
import { getStyleTag, shim, virtualSheet } from "https://esm.sh/v94/twind@0.16.17/deno/shim/server.js";
import type { VirtualSheet } from "https://esm.sh/v94/twind@0.16.17/shim/server/server.d.ts";

let sheet: VirtualSheet | undefined;
function createSheet(): VirtualSheet {
	if (sheet === undefined) {
		try {
			sheet = virtualSheet();
			setup({ sheet });
		} catch (err) {
			sheet = undefined;
			throw err;
		}
	}
	return sheet;
}

export function ssr(component: CallableFunction, twindOptions?: TW): Response {
	try {
		const sheet = createSheet();
		sheet.reset();
		const app = renderSSR(component(), {});
		shim(app, twindOptions);
		const { body, head, footer } = Helmet.SSR(app);
		const style = getStyleTag(sheet);
		return new Response(
			`<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		${head.join("\n")}
		${style}
	</head>
	<body>
		${body}
		${footer.join("\n")}
	</body>
	<html>`,
			{ headers: { "Content-Type": "text/html; charset=utf-8" } },
		);
	} catch (err) {
		console.log(err);
		return new Response(
			`<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title></title>
	</head>
	<body>
		... ${err}
	</body>
	<html>`,
			{ status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
		);
	}
}

export function memoSSR(component: CallableFunction, twindOptions?: TW) {
	let mresp: Response | undefined;
	return () => {
		const resp = mresp ?? (mresp = ssr(component, twindOptions));
		return resp.clone();
	};
}
